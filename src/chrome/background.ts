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
import {
  savePendingTxRequest,
  removePendingTxRequest,
  getPendingTxRequestById,
  getPendingTxRequests,
  clearExpiredTxRequests,
  updateBadge,
  PendingTxRequest,
} from "./pendingTxStorage";

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

// Active transaction AbortControllers for cancellation
const activeAbortControllers = new Map<string, AbortController>();

// Active job IDs and API keys for cancellation via Bankr API
const activeJobs = new Map<string, { jobId: string; apiKey: string }>();

// Session cache for decrypted API key and password (cleared on restart/suspend)
let cachedApiKey: string | null = null;
let cachedPassword: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

/**
 * Gets cached API key if still valid
 */
function getCachedApiKey(): string | null {
  if (cachedApiKey && Date.now() - cacheTimestamp < CACHE_TIMEOUT) {
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
  if (cachedPassword && Date.now() - cacheTimestamp < CACHE_TIMEOUT) {
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

// Clear cache when service worker suspends
self.addEventListener("suspend", () => {
  clearCachedApiKey();
});

// Clean up expired transactions periodically
setInterval(() => {
  clearExpiredTxRequests();
}, 60000); // Every minute

// Initialize badge on startup
updateBadge();

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

  // Open the extension popup for user to confirm
  openExtensionPopup(senderWindowId);
}

/**
 * Opens the extension popup window for transaction confirmation
 */
async function openExtensionPopup(senderWindowId?: number): Promise<void> {
  // Check if popup window already exists
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

  const popupWidth = 380;
  const popupHeight = 540;

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
  }

  return false;
});

// Export for module
export {};
