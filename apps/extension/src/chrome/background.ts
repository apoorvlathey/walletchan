/**
 * Background service worker for handling transactions
 * - Receives transaction requests from content script
 * - Stores pending transactions persistently
 * - Submits approved transactions to Bankr API
 * - Returns results to content script
 */

import { loadDecryptedApiKey, hasEncryptedApiKey } from "./crypto";
import {
  submitTransaction,
  pollJobUntilComplete,
  cancelJob,
  TransactionParams,
  BankrApiError,
} from "./bankrApi";
import { ALLOWED_CHAIN_IDS, CHAIN_NAMES } from "../constants/networks";
import { CHAIN_CONFIG } from "../constants/chainConfig";
import {
  savePendingTxRequest,
  removePendingTxRequest,
  getPendingTxRequestById,
  getPendingTxRequests,
  clearExpiredTxRequests,
  updateBadge,
  PendingTxRequest,
} from "./pendingTxStorage";
import {
  savePendingSignatureRequest,
  removePendingSignatureRequest,
  getPendingSignatureRequestById,
  getPendingSignatureRequests,
  clearExpiredSignatureRequests,
  PendingSignatureRequest,
  SignatureParams,
} from "./pendingSignatureStorage";
import {
  addTxToHistory,
  updateTxInHistory,
  getTxHistory,
  getProcessingTxs,
  clearTxHistory,
} from "./txHistoryStorage";

// In-memory map for resolving transaction promises back to content script
interface PendingResolver {
  resolve: (result: TransactionResult) => void;
}

interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

const pendingResolvers = new Map<string, PendingResolver>();

// In-memory map for resolving signature requests back to content script
interface PendingSignatureResolver {
  resolve: (result: SignatureResult) => void;
}

interface SignatureResult {
  success: boolean;
  signature?: string;
  error?: string;
}

const pendingSignatureResolvers = new Map<string, PendingSignatureResolver>();

// Active transaction AbortControllers for cancellation
const activeAbortControllers = new Map<string, AbortController>();

// Active job IDs and API keys for cancellation via Bankr API
const activeJobs = new Map<string, { jobId: string; apiKey: string }>();

// Store failed transaction results for display when opening from notification
interface FailedTxResult {
  txId: string;
  error: string;
  origin: string;
  chainId: number;
  timestamp: number;
}
const failedTxResults = new Map<string, FailedTxResult>();

// Session cache for decrypted API key and password (cleared on restart/suspend)
let cachedApiKey: string | null = null;
let cachedPassword: string | null = null;
let cacheTimestamp: number = 0;

// Auto-lock timeout configuration
const DEFAULT_AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes default
const AUTO_LOCK_STORAGE_KEY = "autoLockTimeout";
let cachedAutoLockTimeout: number | null = null;

// Valid auto-lock timeout values (in milliseconds)
const VALID_AUTO_LOCK_TIMEOUTS = new Set([
  60000,      // 1 minute
  300000,     // 5 minutes
  900000,     // 15 minutes (default)
  1800000,    // 30 minutes
  3600000,    // 1 hour
  14400000,   // 4 hours
  0,          // Never
]);

/**
 * Gets the auto-lock timeout from storage (with caching)
 */
async function getAutoLockTimeout(): Promise<number> {
  if (cachedAutoLockTimeout !== null) {
    return cachedAutoLockTimeout;
  }
  const result = await chrome.storage.sync.get(AUTO_LOCK_STORAGE_KEY);
  const timeout = result[AUTO_LOCK_STORAGE_KEY] ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  cachedAutoLockTimeout = timeout;
  return timeout;
}

/**
 * Sets the auto-lock timeout in storage
 * Returns false if the timeout value is not in the allowed list
 */
async function setAutoLockTimeout(timeout: number): Promise<boolean> {
  if (!VALID_AUTO_LOCK_TIMEOUTS.has(timeout)) {
    return false;
  }
  await chrome.storage.sync.set({ [AUTO_LOCK_STORAGE_KEY]: timeout });
  cachedAutoLockTimeout = timeout;
  return true;
}

// Listen for storage changes to update cached timeout and broadcast address changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "sync") {
    if (changes[AUTO_LOCK_STORAGE_KEY]) {
      cachedAutoLockTimeout = changes[AUTO_LOCK_STORAGE_KEY].newValue ?? DEFAULT_AUTO_LOCK_TIMEOUT;
    }

    // Broadcast address changes to all tabs so dapps receive accountsChanged event
    if (changes.address) {
      const newAddress = changes.address.newValue;
      const newDisplayAddress = changes.displayAddress?.newValue || newAddress;

      if (newAddress) {
        // Get all tabs and send setAddress message
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
            chrome.tabs.sendMessage(tab.id, {
              type: "setAddress",
              msg: { address: newAddress, displayAddress: newDisplayAddress },
            }).catch(() => {
              // Ignore errors for tabs without content script
            });
          }
        }
      }
    }
  }
});

/**
 * Gets cached API key if still valid
 */
function getCachedApiKey(): string | null {
  const timeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  // timeout of 0 means "Never" - cache never expires
  if (cachedApiKey && (timeout === 0 || Date.now() - cacheTimestamp < timeout)) {
    return cachedApiKey;
  }
  cachedApiKey = null;
  cachedPassword = null;
  return null;
}

/**
 * Gets cached password if still valid
 */
function getCachedPassword(): string | null {
  const timeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  // timeout of 0 means "Never" - cache never expires
  if (cachedPassword && (timeout === 0 || Date.now() - cacheTimestamp < timeout)) {
    return cachedPassword;
  }
  cachedPassword = null;
  return null;
}

/**
 * Caches the decrypted API key and password
 */
function setCachedApiKey(apiKey: string, password?: string): void {
  cachedApiKey = apiKey;
  if (password) {
    cachedPassword = password;
  }
  cacheTimestamp = Date.now();
}

/**
 * Clears the cached API key and password
 */
function clearCachedApiKey(): void {
  cachedApiKey = null;
  cachedPassword = null;
  cacheTimestamp = 0;
}

/**
 * Performs a full security reset - clears ALL sensitive data from memory
 * This should be called when resetting the extension
 */
function performSecurityReset(): void {
  // 1. Clear cached credentials
  clearCachedApiKey();

  // 2. Abort all active transactions and clear their API keys from memory
  for (const [txId, abortController] of activeAbortControllers.entries()) {
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors
    }
  }
  activeAbortControllers.clear();

  // 3. Clear activeJobs which contains decrypted API keys for in-flight transactions
  // This is critical - API keys must not persist after reset
  activeJobs.clear();

  // 4. Reject all pending resolvers with reset error
  for (const [txId, resolver] of pendingResolvers.entries()) {
    try {
      resolver.resolve({ success: false, error: "Extension was reset" });
    } catch {
      // Ignore errors
    }
  }
  pendingResolvers.clear();

  // 5. Reject all pending signature resolvers with reset error
  for (const [sigId, resolver] of pendingSignatureResolvers.entries()) {
    try {
      resolver.resolve({ success: false, error: "Extension was reset" });
    } catch {
      // Ignore errors
    }
  }
  pendingSignatureResolvers.clear();

  // 6. Clear failed transaction results
  failedTxResults.clear();
}

// Clear cache when service worker suspends
self.addEventListener("suspend", () => {
  clearCachedApiKey();
});

// Clean up expired transactions and signature requests periodically
setInterval(() => {
  clearExpiredTxRequests();
  clearExpiredSignatureRequests();
}, 60000); // Every minute

// Initialize badge on startup
updateBadge();

// Initialize auto-lock timeout cache on startup
getAutoLockTimeout();

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // First time install - open onboarding page
    const onboardingUrl = chrome.runtime.getURL("onboarding.html");
    await chrome.tabs.create({ url: onboardingUrl });
  }
});

/**
 * Checks if we're running in Arc browser
 * Arc has chrome.sidePanel but it doesn't work properly
 * Note: In service worker context, we can't check CSS variables, so we use storage
 */
function isArcBrowser(): boolean {
  try {
    // Arc browser identifies itself in the user agent
    return navigator.userAgent.includes("Arc/");
  } catch {
    return false;
  }
}

/**
 * Checks if the browser supports the sidePanel API
 * Note: Some browsers (like Arc) may have chrome.sidePanel defined but non-functional
 */
function isSidePanelSupported(): boolean {
  try {
    // Arc browser has broken sidepanel support - skip entirely
    if (isArcBrowser()) {
      return false;
    }
    return typeof chrome !== "undefined" &&
      typeof chrome.sidePanel !== "undefined" &&
      chrome.sidePanel !== null &&
      typeof chrome.sidePanel.setPanelBehavior === "function";
  } catch {
    return false;
  }
}

/**
 * Tests if sidepanel actually works by attempting to set panel behavior
 * Returns true only if the API call succeeds
 */
async function testSidePanelWorks(): Promise<boolean> {
  try {
    if (!isSidePanelSupported()) {
      return false;
    }

    // Try to set panel behavior - if this fails, the API is broken
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    return true;
  } catch (error) {
    console.warn("SidePanel API exists but is non-functional:", error);
    return false;
  }
}

/**
 * Gets the current sidepanel mode setting
 */
async function getSidePanelMode(): Promise<boolean> {
  if (!isSidePanelSupported()) {
    return false;
  }
  // Check if we've previously determined sidepanel doesn't work (e.g., Arc browser)
  const { sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get(["sidePanelMode", "sidePanelVerified"]);

  // If we haven't verified yet, or verification found it doesn't work, return false
  if (sidePanelVerified === false) {
    return false;
  }

  // Default to true (sidepanel mode) if supported and not explicitly set to false
  return sidePanelMode !== false;
}

/**
 * Sets the sidepanel mode setting
 * Returns false if setting sidepanel behavior failed (browser doesn't support it properly)
 */
async function setSidePanelMode(enabled: boolean): Promise<boolean> {
  // Check if Arc browser first - sidepanel is broken there
  const { isArcBrowser: storedIsArc } = await chrome.storage.sync.get(["isArcBrowser"]);
  if (storedIsArc && enabled) {
    // Can't enable sidepanel in Arc
    return false;
  }

  if (!isSidePanelSupported()) {
    // No sidepanel support at all
    if (enabled) {
      return false;
    }
    await chrome.storage.sync.set({ sidePanelMode: false });
    return true; // Successfully set to popup mode (the only option)
  }

  try {
    if (enabled) {
      // Trying to enable sidepanel - test first
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      // If we get here, it worked
      await chrome.storage.sync.set({ sidePanelMode: true, sidePanelVerified: true });
      return true;
    } else {
      // Disabling sidepanel (going to popup mode)
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      await chrome.storage.sync.set({ sidePanelMode: false });
      return true;
    }
  } catch (error) {
    console.warn("Failed to set sidepanel behavior:", error);
    // Mark sidepanel as not working for this browser
    await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
    return false;
  }
}

// Initialize sidepanel behavior on startup
// IMPORTANT: We default to popup mode and only enable sidepanel when explicitly requested by UI
// This ensures Arc browser (where sidepanel is broken) works properly with popup
(async () => {
  try {
    // Check if we've stored that this is Arc browser (detected by UI via CSS variable)
    const { isArcBrowser: storedIsArc, sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get([
      "isArcBrowser",
      "sidePanelMode",
      "sidePanelVerified"
    ]);

    if (storedIsArc) {
      // Arc browser - sidepanel doesn't work, ensure popup mode
      console.log("Arc browser detected, ensuring popup mode");
      // Make absolutely sure sidepanel won't intercept clicks
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors
        }
      }
      return;
    }

    // If sidepanel has been verified as not working, ensure popup mode
    if (sidePanelVerified === false) {
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors
        }
      }
      return;
    }

    // Only enable sidepanel if it's explicitly been enabled by user AND verified to work
    // This is the key change: we don't auto-enable sidepanel on first run
    if (isSidePanelSupported() && sidePanelMode === true && sidePanelVerified === true) {
      try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      } catch (error) {
        // If setting sidepanel fails, disable it
        console.warn("Failed to enable sidepanel:", error);
        await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
      }
    } else {
      // Default: ensure popup mode (sidepanel won't intercept clicks)
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors - some browsers don't have this API
        }
      }
    }
  } catch (error) {
    // If anything fails during sidepanel initialization, log and continue
    // The extension will fall back to popup mode (which is the safe default)
    console.error("Error during sidepanel initialization:", error);
  }
})();

/**
 * Handles incoming transaction requests from content script
 */
async function handleTransactionRequest(
  message: {
    type: string;
    tx: TransactionParams;
    origin: string;
    favicon?: string | null;
  },
  sendResponse: (response: TransactionResult) => void,
  senderWindowId?: number
): Promise<void> {
  const { tx, origin, favicon } = message;

  // Validate chain ID
  if (!ALLOWED_CHAIN_IDS.has(tx.chainId)) {
    sendResponse({
      success: false,
      error: `Chain ${tx.chainId} not supported. Supported chains: ${Array.from(
        ALLOWED_CHAIN_IDS
      )
        .map((id) => CHAIN_NAMES[id] || id)
        .join(", ")}`,
    });
    return;
  }

  // Check if API key is configured
  const hasKey = await hasEncryptedApiKey();
  if (!hasKey) {
    sendResponse({
      success: false,
      error: "API key not configured. Please configure your Bankr API key in the extension settings.",
    });
    return;
  }

  // Create pending transaction request
  const txId = crypto.randomUUID();
  const chainName = CHAIN_NAMES[tx.chainId] || `Chain ${tx.chainId}`;

  const pendingRequest: PendingTxRequest = {
    id: txId,
    tx,
    origin,
    favicon: favicon || null,
    chainName,
    timestamp: Date.now(),
  };

  // Store the pending request persistently
  await savePendingTxRequest(pendingRequest);

  // Store the resolver to respond when user confirms/rejects
  pendingResolvers.set(txId, { resolve: sendResponse });

  // Notify any open extension views (sidepanel/popup) about the new tx request
  chrome.runtime.sendMessage({ type: "newPendingTxRequest", txRequest: pendingRequest }).catch(() => {
    // Ignore errors if no listeners (popup/sidepanel not open)
  });

  // Open the extension popup/sidepanel for user to confirm
  openExtensionPopup(senderWindowId);
}

/**
 * Handles incoming signature requests from content script
 */
async function handleSignatureRequest(
  message: {
    type: string;
    signature: SignatureParams;
    origin: string;
    favicon?: string | null;
  },
  sendResponse: (response: SignatureResult) => void,
  senderWindowId?: number
): Promise<void> {
  const { signature, origin, favicon } = message;

  // Create pending signature request
  const sigId = crypto.randomUUID();
  const chainName = CHAIN_NAMES[signature.chainId] || `Chain ${signature.chainId}`;

  const pendingRequest: PendingSignatureRequest = {
    id: sigId,
    signature,
    origin,
    favicon: favicon || null,
    chainName,
    timestamp: Date.now(),
  };

  // Store the pending request persistently
  await savePendingSignatureRequest(pendingRequest);

  // Store the resolver to respond when user cancels
  pendingSignatureResolvers.set(sigId, { resolve: sendResponse });

  // Notify any open extension views (sidepanel/popup) about the new signature request
  chrome.runtime.sendMessage({ type: "newPendingSignatureRequest", sigRequest: pendingRequest }).catch(() => {
    // Ignore errors if no listeners (popup/sidepanel not open)
  });

  // Open the extension popup/sidepanel for user to view
  openExtensionPopup(senderWindowId);
}

/**
 * Opens the extension popup window for transaction confirmation
 * Respects user preference, falls back to popup for unsupported browsers (e.g., Arc)
 */
async function openExtensionPopup(senderWindowId?: number): Promise<void> {
  const useSidePanel = await getSidePanelMode();

  // If sidepanel mode is enabled, check if we can detect an open sidepanel
  // by trying to send a ping message - if a view responds, it's open
  if (useSidePanel && isSidePanelSupported()) {
    try {
      // Try to ping any open extension views
      const response = await chrome.runtime.sendMessage({ type: "ping" }).catch(() => null);
      if (response === "pong") {
        // An extension view is open and responded, don't open popup
        return;
      }
    } catch {
      // No views responded, continue to open popup
    }
  }
  const existingWindows = await chrome.windows.getAll({ windowTypes: ["popup"] });
  const popupUrl = chrome.runtime.getURL("index.html");

  for (const win of existingWindows) {
    if (win.id) {
      const tabs = await chrome.tabs.query({ windowId: win.id });
      if (tabs.some(tab => tab.url?.startsWith(popupUrl))) {
        // Focus existing popup window
        await chrome.windows.update(win.id, { focused: true });
        return;
      }
    }
  }

  // Get the window where the dapp is running
  // Try multiple methods to ensure we get the correct window
  let targetWindow: chrome.windows.Window | null = null;

  // Method 1: Use sender's window ID (most accurate)
  if (senderWindowId) {
    try {
      targetWindow = await chrome.windows.get(senderWindowId, { populate: false });
    } catch {
      // Window might have been closed
      targetWindow = null;
    }
  }

  // Method 2: Fall back to last focused window
  if (!targetWindow || targetWindow.left === undefined) {
    try {
      targetWindow = await chrome.windows.getLastFocused({ populate: false });
    } catch {
      targetWindow = null;
    }
  }

  const popupWidth = 360;
  const popupHeight = 680;

  // Calculate position: top-right of target window
  // Use the window's actual coordinates (which include multi-monitor offsets)
  let left: number | undefined;
  let top: number | undefined;

  if (targetWindow &&
      targetWindow.left !== undefined &&
      targetWindow.width !== undefined &&
      targetWindow.top !== undefined) {
    // Position at right edge of target window, with small margin
    left = targetWindow.left + targetWindow.width - popupWidth - 10;
    // Position at top of target window, with margin for toolbar
    top = targetWindow.top + 80;
  }

  // Create new popup window
  const createOptions: chrome.windows.CreateData = {
    url: popupUrl,
    type: "popup",
    width: popupWidth,
    height: popupHeight,
    focused: true,
  };

  // Only set position if we have valid coordinates
  // This allows Chrome to handle positioning on the correct monitor
  if (left !== undefined && top !== undefined) {
    createOptions.left = left;
    createOptions.top = top;
  }

  await chrome.windows.create(createOptions);
}

/**
 * Opens a popup window (used when switching from sidepanel to popup mode)
 */
async function openPopupWindow(): Promise<void> {
  const popupUrl = chrome.runtime.getURL("index.html");

  // Check if popup window already exists
  const existingWindows = await chrome.windows.getAll({ windowTypes: ["popup"] });
  for (const win of existingWindows) {
    if (win.id) {
      const tabs = await chrome.tabs.query({ windowId: win.id });
      if (tabs.some(tab => tab.url?.startsWith(popupUrl))) {
        await chrome.windows.update(win.id, { focused: true });
        return;
      }
    }
  }

  // Get last focused window for positioning
  let targetWindow: chrome.windows.Window | null = null;
  try {
    targetWindow = await chrome.windows.getLastFocused({ populate: false });
  } catch {
    targetWindow = null;
  }

  const popupWidth = 360;
  const popupHeight = 680;

  let left: number | undefined;
  let top: number | undefined;

  if (targetWindow &&
      targetWindow.left !== undefined &&
      targetWindow.width !== undefined &&
      targetWindow.top !== undefined) {
    left = targetWindow.left + targetWindow.width - popupWidth - 10;
    top = targetWindow.top + 80;
  }

  const createOptions: chrome.windows.CreateData = {
    url: popupUrl,
    type: "popup",
    width: popupWidth,
    height: popupHeight,
    focused: true,
  };

  if (left !== undefined && top !== undefined) {
    createOptions.left = left;
    createOptions.top = top;
  }

  await chrome.windows.create(createOptions);
}

/**
 * Handles confirmation from the popup
 */
async function handleConfirmTransaction(
  txId: string,
  password: string
): Promise<TransactionResult> {
  const pending = await getPendingTxRequestById(txId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired" };
  }

  // Try to use cached API key first
  let apiKey = getCachedApiKey();

  if (!apiKey) {
    // Decrypt API key with provided password
    apiKey = await loadDecryptedApiKey(password);
    if (!apiKey) {
      return { success: false, error: "Invalid password" };
    }
    // Cache the API key and password for future transactions
    setCachedApiKey(apiKey, password);
  }

  // Create AbortController for this transaction
  const abortController = new AbortController();
  activeAbortControllers.set(txId, abortController);

  try {
    // Submit transaction to Bankr API
    const { jobId } = await submitTransaction(apiKey, pending.tx, abortController.signal);

    // Store job ID and API key for potential cancellation
    activeJobs.set(txId, { jobId, apiKey });

    // Poll for completion
    const status = await pollJobUntilComplete(apiKey, jobId, {
      pollInterval: 2000,
      maxDuration: 300000, // 5 minutes
      signal: abortController.signal,
    });

    if (status.status === "completed") {
      // Check for txHash in result
      const txHash = status.result?.txHash;
      if (txHash) {
        return { success: true, txHash };
      }

      const response = status.response || "";

      // Extract transaction hash from response (0x + 64 hex chars)
      const txHashMatch = response.match(/0x[a-fA-F0-9]{64}/);

      if (txHashMatch) {
        return {
          success: true,
          txHash: txHashMatch[0],
        };
      }

      // Check if response contains a transaction URL (indicates success but couldn't extract hash)
      const hasExplorerUrl =
        response.includes("basescan.org/tx/") ||
        response.includes("etherscan.io/tx/") ||
        response.includes("polygonscan.com/tx/") ||
        response.includes("uniscan.xyz/tx/") ||
        response.includes("unichain.org/tx/");

      if (hasExplorerUrl) {
        return {
          success: true,
          txHash: response,
        };
      }

      // Check if response indicates an error
      const isErrorResponse =
        response.toLowerCase().includes("missing required") ||
        response.toLowerCase().includes("error") ||
        response.toLowerCase().includes("can't execute") ||
        response.toLowerCase().includes("cannot") ||
        response.toLowerCase().includes("unable to") ||
        response.toLowerCase().includes("invalid") ||
        response.toLowerCase().includes("not supported");

      if (isErrorResponse) {
        return {
          success: false,
          error: response,
        };
      }

      // If we have status updates, it likely succeeded
      if (status.statusUpdates && status.statusUpdates.length > 0) {
        return {
          success: true,
          txHash: response || "Transaction completed"
        };
      }

      // Fallback - assume success if status is completed
      return {
        success: true,
        txHash: response || "Transaction completed",
      };
    } else if (status.status === "failed") {
      return {
        success: false,
        error: status.result?.error || status.response || "Transaction failed",
      };
    } else {
      return { success: false, error: "Unexpected job status" };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Transaction cancelled by user" };
    }
    if (error instanceof BankrApiError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    activeAbortControllers.delete(txId);
    activeJobs.delete(txId);
  }
}

/**
 * Handles rejection from the popup
 */
function handleRejectTransaction(txId: string): TransactionResult {
  return { success: false, error: "Transaction rejected by user" };
}

/**
 * Handles cancellation of an in-progress transaction
 */
async function handleCancelTransaction(txId: string): Promise<{ success: boolean; error?: string }> {
  const abortController = activeAbortControllers.get(txId);
  const activeJob = activeJobs.get(txId);

  if (!abortController && !activeJob) {
    return { success: false, error: "No active transaction to cancel" };
  }

  // Abort local polling
  if (abortController) {
    abortController.abort();
    activeAbortControllers.delete(txId);
  }

  // Cancel job via Bankr API
  if (activeJob) {
    try {
      await cancelJob(activeJob.apiKey, activeJob.jobId);
    } catch (error) {
      // Log but don't fail - local abort is enough
      console.error("Failed to cancel job via API:", error);
    }
    activeJobs.delete(txId);
  }

  return { success: true };
}

/**
 * Shows a browser notification
 */
async function showNotification(
  notificationId: string,
  title: string,
  message: string
): Promise<string> {
  return new Promise((resolve) => {
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title,
        message,
        priority: 2,
      },
      (createdId) => {
        if (chrome.runtime.lastError) {
          console.error("Notification error:", chrome.runtime.lastError);
        }
        resolve(createdId || notificationId);
      }
    );
  });
}

/**
 * Handles async confirmation - returns immediately and polls in background
 */
async function handleConfirmTransactionAsync(
  txId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const pending = await getPendingTxRequestById(txId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired" };
  }

  // Try to use cached API key first
  let apiKey = getCachedApiKey();

  if (!apiKey) {
    // Decrypt API key with provided password
    apiKey = await loadDecryptedApiKey(password);
    if (!apiKey) {
      return { success: false, error: "Invalid password" };
    }
    // Cache the API key and password for future transactions
    setCachedApiKey(apiKey, password);
  }

  // Remove from pending storage immediately
  await removePendingTxRequest(txId);

  // Start background processing
  processTransactionInBackground(txId, pending, apiKey);

  return { success: true };
}

/**
 * Processes transaction in background and shows notification on completion
 */
async function processTransactionInBackground(
  txId: string,
  pending: PendingTxRequest,
  apiKey: string
): Promise<void> {
  // Create AbortController for this transaction
  const abortController = new AbortController();
  activeAbortControllers.set(txId, abortController);

  // Save to history as "processing" immediately
  await addTxToHistory({
    id: txId,
    status: "processing",
    tx: pending.tx,
    origin: pending.origin,
    favicon: pending.favicon,
    chainName: pending.chainName,
    chainId: pending.tx.chainId,
    createdAt: pending.timestamp,
  });

  try {
    // Submit transaction to Bankr API
    const { jobId } = await submitTransaction(apiKey, pending.tx, abortController.signal);

    // Store job ID and API key for potential cancellation
    activeJobs.set(txId, { jobId, apiKey });

    // Poll for completion
    const status = await pollJobUntilComplete(apiKey, jobId, {
      pollInterval: 2000,
      maxDuration: 300000, // 5 minutes
      signal: abortController.signal,
    });

    // Send result back to content script
    const resolver = pendingResolvers.get(txId);

    if (status.status === "completed") {
      // Check for txHash in result
      let txHash = status.result?.txHash;
      const response = status.response || "";

      if (!txHash) {
        // Extract transaction hash from response (0x + 64 hex chars)
        const txHashMatch = response.match(/0x[a-fA-F0-9]{64}/);
        if (txHashMatch) {
          txHash = txHashMatch[0];
        }
      }

      if (txHash) {
        // Update history to "success"
        await updateTxInHistory(txId, {
          status: "success",
          txHash,
          completedAt: Date.now(),
        });

        // Success with hash - show notification
        const notificationId = `tx-success-${txId}`;
        const chainConfig = CHAIN_CONFIG[pending.tx.chainId];
        const explorerUrl = chainConfig?.explorer
          ? `${chainConfig.explorer}/tx/${txHash}`
          : null;

        // Store explorer URL for notification click
        if (explorerUrl) {
          chrome.storage.local.set({ [`notification-${notificationId}`]: explorerUrl });
        }

        await showNotification(
          notificationId,
          "Transaction Confirmed",
          `Transaction on ${pending.chainName} was successful. Click to view.`
        );

        if (resolver) {
          resolver.resolve({ success: true, txHash });
        }
      } else {
        // Check if response contains a transaction URL
        const hasExplorerUrl =
          response.includes("basescan.org/tx/") ||
          response.includes("etherscan.io/tx/") ||
          response.includes("polygonscan.com/tx/") ||
          response.includes("uniscan.xyz/tx/") ||
          response.includes("unichain.org/tx/");

        if (hasExplorerUrl || (status.statusUpdates && status.statusUpdates.length > 0)) {
          // Update history to "success"
          await updateTxInHistory(txId, {
            status: "success",
            txHash: response || undefined,
            completedAt: Date.now(),
          });

          await showNotification(
            `tx-success-${txId}`,
            "Transaction Completed",
            `Transaction on ${pending.chainName} completed.`
          );

          if (resolver) {
            resolver.resolve({ success: true, txHash: response || "Transaction completed" });
          }
        } else {
          // Check if response indicates an error
          const isErrorResponse =
            response.toLowerCase().includes("missing required") ||
            response.toLowerCase().includes("error") ||
            response.toLowerCase().includes("can't execute") ||
            response.toLowerCase().includes("cannot") ||
            response.toLowerCase().includes("unable to") ||
            response.toLowerCase().includes("invalid") ||
            response.toLowerCase().includes("not supported");

          if (isErrorResponse) {
            await handleTransactionFailure(txId, pending, response, resolver);
          } else {
            // Assume success - update history
            await updateTxInHistory(txId, {
              status: "success",
              txHash: response || undefined,
              completedAt: Date.now(),
            });

            await showNotification(
              `tx-success-${txId}`,
              "Transaction Completed",
              `Transaction on ${pending.chainName} completed.`
            );

            if (resolver) {
              resolver.resolve({ success: true, txHash: response || "Transaction completed" });
            }
          }
        }
      }
    } else if (status.status === "failed") {
      const error = status.result?.error || status.response || "Transaction failed";
      await handleTransactionFailure(txId, pending, error, resolver);
    } else {
      await handleTransactionFailure(txId, pending, "Unexpected job status", resolver);
    }
  } catch (error) {
    const resolver = pendingResolvers.get(txId);
    let errorMessage = "Unknown error";

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Transaction cancelled by user";
      } else {
        errorMessage = error.message;
      }
    }

    await handleTransactionFailure(txId, pending, errorMessage, resolver);
  } finally {
    activeAbortControllers.delete(txId);
    activeJobs.delete(txId);
    pendingResolvers.delete(txId);
  }
}

/**
 * Handles transaction failure - shows notification and stores error for display
 */
async function handleTransactionFailure(
  txId: string,
  pending: PendingTxRequest,
  error: string,
  resolver?: PendingResolver
): Promise<void> {
  const notificationId = `tx-failed-${txId}`;

  // Update history to "failed"
  await updateTxInHistory(txId, {
    status: "failed",
    error,
    completedAt: Date.now(),
  });

  // Store failed result for display when opening from notification
  failedTxResults.set(notificationId, {
    txId,
    error,
    origin: pending.origin,
    chainId: pending.tx.chainId,
    timestamp: Date.now(),
  });

  // Store notification ID for click handler
  chrome.storage.local.set({ [`notification-${notificationId}`]: { type: "error", txId: notificationId } });

  await showNotification(
    notificationId,
    "Transaction Failed",
    error.length > 100 ? error.substring(0, 100) + "..." : error
  );

  if (resolver) {
    resolver.resolve({ success: false, error });
  }
}

/**
 * Checks if the API key is currently cached (no password needed)
 */
function isApiKeyCached(): boolean {
  return getCachedApiKey() !== null;
}

/**
 * Attempts to unlock the wallet by caching the decrypted API key
 */
async function handleUnlockWallet(password: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = await loadDecryptedApiKey(password);
  if (!apiKey) {
    return { success: false, error: "Invalid password" };
  }
  setCachedApiKey(apiKey, password);
  return { success: true };
}

/**
 * Saves a new API key using the currently cached password
 * This is used when changing API key while already unlocked
 */
async function handleSaveApiKeyWithCachedPassword(
  newApiKey: string
): Promise<{ success: boolean; error?: string }> {
  const password = getCachedPassword();
  if (!password) {
    return { success: false, error: "Wallet is locked. Please unlock first." };
  }

  try {
    const { saveEncryptedApiKey } = await import("./crypto");
    await saveEncryptedApiKey(newApiKey, password);
    // Update the cached API key
    setCachedApiKey(newApiKey, password);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save API key"
    };
  }
}

/**
 * Changes the wallet password using the currently cached password
 * This is used when changing password while already unlocked
 */
async function handleChangePasswordWithCachedPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const currentPassword = getCachedPassword();
  if (!currentPassword) {
    return { success: false, error: "Session expired. Please unlock your wallet again." };
  }

  try {
    const { loadDecryptedApiKey, saveEncryptedApiKey } = await import("./crypto");

    // Decrypt API key with cached password
    const apiKey = await loadDecryptedApiKey(currentPassword);
    if (!apiKey) {
      return { success: false, error: "Failed to decrypt API key" };
    }

    // Re-encrypt with new password
    await saveEncryptedApiKey(apiKey, newPassword);

    // Clear the cache - user must unlock with new password
    clearCachedApiKey();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password"
    };
  }
}

/**
 * Handles RPC requests proxied from inpage script (to bypass page CSP)
 */
async function handleRpcRequest(
  rpcUrl: string,
  method: string,
  params: any[]
): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC error");
  }

  return data.result;
}

// Port connection listener - used for waking up the service worker
// Some browsers (like Arc) don't auto-wake the service worker when popup opens
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-wake") {
    // Just acknowledge the connection - the popup is waking us up
    console.log("Service worker woken up by popup");
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "sendTransaction": {
      // Handle async response, pass sender's window ID for popup positioning
      const senderWindowId = sender.tab?.windowId;
      handleTransactionRequest(message, sendResponse, senderWindowId);
      // Return true to indicate we will send response asynchronously
      return true;
    }

    case "signatureRequest": {
      // Handle signature request, pass sender's window ID for popup positioning
      const senderWindowId = sender.tab?.windowId;
      handleSignatureRequest(message, sendResponse, senderWindowId);
      // Return true to indicate we will send response asynchronously
      return true;
    }

    case "getPendingSignatureRequests": {
      getPendingSignatureRequests().then((requests) => {
        sendResponse(requests);
      });
      return true;
    }

    case "rejectSignatureRequest": {
      const result: SignatureResult = { success: false, error: "Signature request cancelled by user" };

      // Remove from pending storage
      removePendingSignatureRequest(message.sigId).then(() => {
        // Send result back to content script if resolver exists
        const resolver = pendingSignatureResolvers.get(message.sigId);
        if (resolver) {
          resolver.resolve(result);
          pendingSignatureResolvers.delete(message.sigId);
        }
        sendResponse(result);
      });
      return true;
    }

    case "getPendingTxRequests": {
      getPendingTxRequests().then((requests) => {
        sendResponse(requests);
      });
      return true;
    }

    case "getPendingTransaction": {
      getPendingTxRequestById(message.txId).then((request) => {
        if (request) {
          sendResponse({
            tx: request.tx,
            origin: request.origin,
            chainName: request.chainName,
            favicon: request.favicon,
          });
        } else {
          sendResponse(null);
        }
      });
      return true;
    }

    case "isApiKeyCached": {
      sendResponse(isApiKeyCached());
      return false;
    }

    case "confirmTransaction": {
      handleConfirmTransaction(message.txId, message.password).then(
        async (result) => {
          // Remove from pending storage
          await removePendingTxRequest(message.txId);

          // Send result back to content script if resolver exists
          const resolver = pendingResolvers.get(message.txId);
          if (resolver) {
            resolver.resolve(result);
            pendingResolvers.delete(message.txId);
          }
          sendResponse(result);
        }
      );
      return true;
    }

    case "rejectTransaction": {
      const result = handleRejectTransaction(message.txId);

      // Remove from pending storage
      removePendingTxRequest(message.txId).then(() => {
        // Send result back to content script if resolver exists
        const resolver = pendingResolvers.get(message.txId);
        if (resolver) {
          resolver.resolve(result);
          pendingResolvers.delete(message.txId);
        }
        sendResponse(result);
      });
      return true;
    }

    case "cancelTransaction": {
      handleCancelTransaction(message.txId).then((result) => {
        sendResponse(result);
      });
      return true; // Will respond asynchronously
    }

    case "clearApiKeyCache": {
      clearCachedApiKey();
      sendResponse({ success: true });
      return false;
    }

    case "unlockWallet": {
      handleUnlockWallet(message.password).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "lockWallet": {
      clearCachedApiKey();
      sendResponse({ success: true });
      return false;
    }

    case "saveApiKeyWithCachedPassword": {
      handleSaveApiKeyWithCachedPassword(message.apiKey).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "getCachedPassword": {
      // Return whether password is cached (not the actual password for security)
      sendResponse({ hasCachedPassword: getCachedPassword() !== null });
      return false;
    }

    case "changePasswordWithCachedPassword": {
      handleChangePasswordWithCachedPassword(message.newPassword).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "getCachedApiKey": {
      // Return the cached API key if available (for displaying in settings)
      const apiKey = getCachedApiKey();
      sendResponse({ apiKey: apiKey || null });
      return false;
    }

    case "rpcRequest": {
      // Proxy RPC requests to bypass page CSP
      handleRpcRequest(message.rpcUrl, message.method, message.params)
        .then((result) => sendResponse({ result }))
        .catch((error) => sendResponse({ error: error.message }));
      return true; // Will respond asynchronously
    }

    case "setArcBrowser": {
      // UI detected Arc browser - disable sidepanel
      if (message.isArc) {
        // Update storage
        chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false, isArcBrowser: true });
        // Also immediately disable sidepanel behavior to ensure popup mode works
        if (chrome.sidePanel?.setPanelBehavior) {
          chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
            // Ignore errors
          });
        }
      }
      sendResponse({ success: true });
      return false;
    }

    case "isSidePanelSupported": {
      // Return true only if sidepanel API exists AND has been verified to work
      (async () => {
        if (!isSidePanelSupported()) {
          sendResponse({ supported: false });
          return;
        }
        const { sidePanelVerified } = await chrome.storage.sync.get(["sidePanelVerified"]);
        // If not yet verified, assume supported (will be verified on first use)
        // If verified as false, not supported
        sendResponse({ supported: sidePanelVerified !== false });
      })();
      return true;
    }

    case "getSidePanelMode": {
      getSidePanelMode().then((enabled) => {
        sendResponse({ enabled });
      });
      return true;
    }

    case "setSidePanelMode": {
      setSidePanelMode(message.enabled).then((success) => {
        sendResponse({ success, sidePanelWorks: success || !message.enabled });
      });
      return true;
    }

    case "getAutoLockTimeout": {
      getAutoLockTimeout().then((timeout) => {
        sendResponse({ timeout });
      });
      return true;
    }

    case "setAutoLockTimeout": {
      setAutoLockTimeout(message.timeout).then((success) => {
        sendResponse({ success });
      });
      return true;
    }

    case "openPopupWindow": {
      openPopupWindow().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case "confirmTransactionAsync": {
      handleConfirmTransactionAsync(message.txId, message.password).then(
        (result) => {
          sendResponse(result);
        }
      );
      return true;
    }

    case "getFailedTxResult": {
      const result = failedTxResults.get(message.notificationId);
      if (result) {
        // Clear after retrieving
        failedTxResults.delete(message.notificationId);
        chrome.storage.local.remove(`notification-${message.notificationId}`);
      }
      sendResponse(result || null);
      return false;
    }

    case "clearFailedTxResult": {
      failedTxResults.delete(message.notificationId);
      chrome.storage.local.remove(`notification-${message.notificationId}`);
      sendResponse({ success: true });
      return false;
    }

    case "onboardingComplete": {
      // Broadcast to all extension views that onboarding is complete
      chrome.runtime.sendMessage({ type: "onboardingComplete" }).catch(() => {
        // Ignore errors if no listeners
      });
      sendResponse({ success: true });
      return false;
    }

    case "getTxHistory": {
      getTxHistory().then((history) => {
        sendResponse(history);
      });
      return true;
    }

    case "getProcessingTxs": {
      getProcessingTxs().then((txs) => {
        sendResponse(txs);
      });
      return true;
    }

    case "clearTxHistory": {
      clearTxHistory().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case "resetExtension": {
      // SECURITY: Perform full memory cleanup first (before async operations)
      // This ensures API keys are cleared from memory immediately
      performSecurityReset();

      // Clear all stored data - API key, address, transaction history, and notifications
      (async () => {
        try {
          // Get all storage keys to find notification-related entries
          const allLocalStorage = await chrome.storage.local.get(null);
          const notificationKeys = Object.keys(allLocalStorage).filter(
            (key) => key.startsWith("notification-")
          );

          // Remove all sensitive data from storage
          await Promise.all([
            chrome.storage.local.remove([
              "encryptedApiKey",
              "txHistory",
              "pendingTxRequests",
              "pendingSignatureRequests",
              ...notificationKeys, // Clear notification data (may contain tx hashes)
            ]),
            chrome.storage.sync.remove(["address", "sidePanelVerified", "sidePanelMode"]),
          ]);

          // Update badge to show no pending transactions
          await chrome.action.setBadgeText({ text: "" });

          // Clear any active notifications
          const notifications = await chrome.notifications.getAll();
          for (const notificationId of Object.keys(notifications)) {
            chrome.notifications.clear(notificationId);
          }

          sendResponse({ success: true });
        } catch (error) {
          console.error("Failed to reset extension:", error);
          sendResponse({ success: false, error: "Failed to reset extension" });
        }
      })();
      return true;
    }
  }

  return false;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Get stored data for this notification
  const storageKey = `notification-${notificationId}`;
  const data = await chrome.storage.local.get([storageKey]);
  const notificationData = data[storageKey];

  if (notificationData) {
    if (typeof notificationData === "string") {
      // It's an explorer URL - open in new tab
      chrome.tabs.create({ url: notificationData });
      chrome.storage.local.remove(storageKey);
    } else if (notificationData.type === "error") {
      // It's an error - open popup/sidepanel to show error
      const useSidePanel = await getSidePanelMode();

      if (useSidePanel && isSidePanelSupported()) {
        // Try to open sidepanel - but Chrome doesn't allow programmatic open
        // So we open a popup instead with the error info
        const popupUrl = chrome.runtime.getURL(`index.html?showError=${notificationData.txId}`);
        await chrome.windows.create({
          url: popupUrl,
          type: "popup",
          width: 360,
          height: 680,
          focused: true,
        });
      } else {
        // Open popup with error info
        const popupUrl = chrome.runtime.getURL(`index.html?showError=${notificationData.txId}`);
        await chrome.windows.create({
          url: popupUrl,
          type: "popup",
          width: 360,
          height: 680,
          focused: true,
        });
      }
    }
  }

  // Clear the notification
  chrome.notifications.clear(notificationId);
});

// Export for module
export {};
