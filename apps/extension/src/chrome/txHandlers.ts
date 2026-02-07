/**
 * Transaction and signature request handlers
 * Manages pending transactions, signature requests, and their lifecycle
 */

import {
  loadDecryptedApiKey,
  hasEncryptedApiKey,
} from "./crypto";
import {
  submitTransactionDirect,
  signMessageViaApi,
  TransactionParams,
  BankrApiError,
} from "./bankrApi";
import { ALLOWED_CHAIN_IDS, CHAIN_NAMES } from "../constants/networks";
import { CHAIN_CONFIG } from "../constants/chainConfig";
import type { Account } from "./types";
import {
  getActiveAccount,
  getAccountById,
  getAccounts,
  getTabAccount,
  addPrivateKeyAccount as addPKAccountStorage,
  removeAccount,
  addressExists,
  removeSeedGroup,
  updateSeedGroupCount,
} from "./accountStorage";
import { removeMnemonic } from "./mnemonicStorage";
import {
  addKeyToVault,
  removeKeyFromVault,
  decryptAllKeys,
} from "./vaultCrypto";
import {
  signAndBroadcastTransaction,
  handleSignatureRequest as localSignatureRequest,
  deriveAddress,
} from "./localSigner";
import {
  savePendingTxRequest,
  removePendingTxRequest,
  getPendingTxRequestById,
  PendingTxRequest,
} from "./pendingTxStorage";
import {
  savePendingSignatureRequest,
  removePendingSignatureRequest,
  getPendingSignatureRequestById,
  PendingSignatureRequest,
  SignatureParams,
} from "./pendingSignatureStorage";
import {
  addTxToHistory,
  updateTxInHistory,
  getTxById,
} from "./txHistoryStorage";
import {
  getCachedApiKey,
  setCachedApiKey,
  getCachedVault,
  setCachedVault,
  getPrivateKeyFromCache,
  getAutoLockTimeout,
  tryRestoreSession,
} from "./sessionCache";
import { handleUnlockWallet } from "./authHandlers";
import { getSidePanelMode, isSidePanelSupported } from "./sidepanelManager";

// In-memory map for resolving transaction promises back to content script
export interface PendingResolver {
  resolve: (result: TransactionResult) => void;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export const pendingResolvers = new Map<string, PendingResolver>();

// In-memory map for resolving signature requests back to content script
export interface PendingSignatureResolver {
  resolve: (result: SignatureResult) => void;
}

export interface SignatureResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export const pendingSignatureResolvers = new Map<string, PendingSignatureResolver>();

// Active transaction AbortControllers for cancellation
export const activeAbortControllers = new Map<string, AbortController>();

// Store failed transaction results for display when opening from notification
export interface FailedTxResult {
  txId: string;
  error: string;
  origin: string;
  chainId: number;
  timestamp: number;
}
export const failedTxResults = new Map<string, FailedTxResult>();

/**
 * Handles incoming transaction requests from content script
 */
export async function handleTransactionRequest(
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
export async function handleSignatureRequest(
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
export async function openExtensionPopup(senderWindowId?: number): Promise<void> {
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
export async function openPopupWindow(): Promise<void> {
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
export async function handleConfirmTransaction(
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
    const result = await submitTransactionDirect(apiKey, pending.tx, abortController.signal);

    if (result.status === "reverted") {
      return { success: false, error: "Transaction reverted" };
    }

    return { success: true, txHash: result.transactionHash };
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
  }
}

/**
 * Handles rejection from the popup
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleRejectTransaction(_txId: string): TransactionResult {
  return { success: false, error: "Transaction rejected by user" };
}

/**
 * Handles cancellation of an in-progress transaction
 */
export async function handleCancelTransaction(txId: string): Promise<{ success: boolean; error?: string }> {
  const abortController = activeAbortControllers.get(txId);

  if (!abortController) {
    return { success: false, error: "No active transaction to cancel" };
  }

  abortController.abort();
  activeAbortControllers.delete(txId);

  return { success: true };
}

/**
 * Shows a browser notification
 */
export async function showNotification(
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
export async function handleConfirmTransactionAsync(
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
    accountType: "bankr",
  });

  try {
    const result = await submitTransactionDirect(apiKey, pending.tx, abortController.signal);
    const resolver = pendingResolvers.get(txId);
    const txHash = result.transactionHash;

    if (result.status === "reverted") {
      await handleTransactionFailure(txId, pending, "Transaction reverted", resolver);
    } else {
      // success or pending — both mean tx was submitted
      await updateTxInHistory(txId, {
        status: "success",
        txHash,
        completedAt: Date.now(),
      });

      const notificationId = `tx-success-${txId}`;
      const chainConfig = CHAIN_CONFIG[pending.tx.chainId];
      const explorerUrl = chainConfig?.explorer
        ? `${chainConfig.explorer}/tx/${txHash}`
        : null;

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
 * Processes a local (PK) transaction in background
 */
async function processLocalTransactionInBackground(
  txId: string,
  pending: PendingTxRequest,
  account: Account,
  privateKey: `0x${string}`
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
    accountType: account.type as "privateKey" | "seedPhrase",
  });

  try {
    // Get RPC URL for the chain
    const { networksInfo } = await chrome.storage.sync.get("networksInfo");
    let rpcUrl: string | undefined;
    if (networksInfo) {
      for (const chainName of Object.keys(networksInfo)) {
        if (networksInfo[chainName].chainId === pending.tx.chainId) {
          rpcUrl = networksInfo[chainName].rpcUrl;
          break;
        }
      }
    }

    // Sign and broadcast the transaction
    const result = await signAndBroadcastTransaction(privateKey, pending.tx, rpcUrl);
    const txHash = result.txHash;

    // Send result back to content script
    const resolver = pendingResolvers.get(txId);

    // Update history to "success"
    await updateTxInHistory(txId, {
      status: "success",
      txHash,
      completedAt: Date.now(),
    });

    // Show notification
    const notificationId = `tx-success-${txId}`;
    const chainConfig = CHAIN_CONFIG[pending.tx.chainId];
    const explorerUrl = chainConfig?.explorer
      ? `${chainConfig.explorer}/tx/${txHash}`
      : null;

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
  } catch (error) {
    const resolver = pendingResolvers.get(txId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await handleTransactionFailure(txId, pending, errorMessage, resolver);
  } finally {
    activeAbortControllers.delete(txId);
    pendingResolvers.delete(txId);
  }
}

/**
 * Handles async confirmation for PK accounts - signs locally
 */
export async function handleConfirmTransactionAsyncPK(
  txId: string,
  password: string,
  tabId?: number
): Promise<{ success: boolean; error?: string }> {
  const pending = await getPendingTxRequestById(txId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired" };
  }

  // Get the account for this tab
  const account = tabId ? await getTabAccount(tabId) : await getActiveAccount();
  if (!account) {
    return { success: false, error: "No account found" };
  }

  if (account.type !== "privateKey" && account.type !== "seedPhrase") {
    return { success: false, error: "Account does not support local signing" };
  }

  // Try to get private key from cache first
  let privateKey = getPrivateKeyFromCache(account.id);

  if (!privateKey) {
    // Need to decrypt the vault
    const vault = await decryptAllKeys(password);
    if (!vault) {
      return { success: false, error: "Invalid password" };
    }
    setCachedVault(vault);

    // Also cache API key and password if we have encrypted API key
    const hasApiKey = await hasEncryptedApiKey();
    if (hasApiKey) {
      const apiKey = await loadDecryptedApiKey(password);
      if (apiKey) {
        setCachedApiKey(apiKey, password);
      }
    }

    // Get the private key from the now-cached vault
    privateKey = getPrivateKeyFromCache(account.id);
    if (!privateKey) {
      return { success: false, error: "Private key not found for account" };
    }
  }

  // Remove from pending storage immediately
  await removePendingTxRequest(txId);

  // Start background processing
  processLocalTransactionInBackground(txId, pending, account, privateKey);

  return { success: true };
}

/**
 * Handles signature confirmation for PK accounts
 */
export async function handleConfirmSignatureRequest(
  sigId: string,
  password: string,
  tabId?: number
): Promise<SignatureResult> {
  const pending = await getPendingSignatureRequestById(sigId);
  if (!pending) {
    return { success: false, error: "Signature request not found or expired" };
  }

  // Get the account for this tab
  const account = tabId ? await getTabAccount(tabId) : await getActiveAccount();
  if (!account) {
    return { success: false, error: "No account found" };
  }

  if (account.type !== "privateKey" && account.type !== "seedPhrase") {
    return { success: false, error: "Signatures are only supported for Private Key and Seed Phrase accounts" };
  }

  // Try to get private key from cache first
  let privateKey = getPrivateKeyFromCache(account.id);

  if (!privateKey) {
    // Need to decrypt the vault
    const vault = await decryptAllKeys(password);
    if (!vault) {
      return { success: false, error: "Invalid password" };
    }
    setCachedVault(vault);

    // Also cache API key and password if we have encrypted API key
    const hasApiKey = await hasEncryptedApiKey();
    if (hasApiKey) {
      const apiKey = await loadDecryptedApiKey(password);
      if (apiKey) {
        setCachedApiKey(apiKey, password);
      }
    }

    // Get the private key from the now-cached vault
    privateKey = getPrivateKeyFromCache(account.id);
    if (!privateKey) {
      return { success: false, error: "Private key not found for account" };
    }
  }

  try {
    // Sign the message
    const signature = await localSignatureRequest(
      privateKey,
      pending.signature.method,
      pending.signature.params,
      pending.signature.chainId
    );

    // Remove from pending storage
    await removePendingSignatureRequest(sigId);

    return { success: true, signature };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Signing failed",
    };
  }
}

/**
 * Handles signature confirmation for Bankr accounts via /agent/sign API
 */
export async function handleConfirmSignatureRequestBankr(
  sigId: string,
  password: string
): Promise<SignatureResult> {
  const pending = await getPendingSignatureRequestById(sigId);
  if (!pending) {
    return { success: false, error: "Signature request not found or expired" };
  }

  // Try to use cached API key first
  let apiKey = getCachedApiKey();

  if (!apiKey) {
    // Decrypt API key with provided password
    apiKey = await loadDecryptedApiKey(password);
    if (!apiKey) {
      return { success: false, error: "Invalid password" };
    }
    setCachedApiKey(apiKey, password);
  }

  try {
    const result = await signMessageViaApi(
      apiKey,
      pending.signature.method,
      pending.signature.params
    );

    // Remove from pending storage
    await removePendingSignatureRequest(sigId);

    return { success: true, signature: result.signature };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Signing failed",
    };
  }
}

/**
 * Adds a new private key account
 */
export async function handleAddPrivateKeyAccount(
  privateKey: `0x${string}`,
  password: string,
  displayName?: string
): Promise<{ success: boolean; account?: Account; error?: string }> {
  try {
    // Derive address from private key
    const address = deriveAddress(privateKey);

    // Check if address already exists
    if (await addressExists(address)) {
      return { success: false, error: "An account with this address already exists" };
    }

    // Add the account metadata
    const account = await addPKAccountStorage(address, displayName);

    // Add the private key to the vault
    await addKeyToVault(account.id, privateKey, password);

    // Update the cached vault if it exists
    const cachedVaultEntries = getCachedVault();
    if (cachedVaultEntries) {
      cachedVaultEntries.push({ id: account.id, privateKey });
      setCachedVault(cachedVaultEntries);
    }

    // Notify UI of account update
    chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});

    return { success: true, account };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add account",
    };
  }
}

/**
 * Removes an account (and its private key if PK account)
 */
export async function handleRemoveAccount(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // If it's a PK or seed phrase account, remove from vault
    if (account.type === "privateKey" || account.type === "seedPhrase") {
      await removeKeyFromVault(accountId);

      // Update the cached vault if it exists
      const cachedVaultEntries = getCachedVault();
      if (cachedVaultEntries) {
        const filtered = cachedVaultEntries.filter((e) => e.id !== accountId);
        setCachedVault(filtered);
      }
    }

    // For seed phrase accounts: clean up group if this is the last account
    if (account.type === "seedPhrase") {
      const seedGroupId = (account as any).seedGroupId;
      const allAccounts = await getAccounts();
      const remaining = allAccounts.filter(
        (a) => a.type === "seedPhrase" && (a as any).seedGroupId === seedGroupId && a.id !== accountId
      );
      if (remaining.length === 0) {
        // Last account in this group - remove mnemonic and group
        await removeMnemonic(seedGroupId);
        await removeSeedGroup(seedGroupId);
      } else {
        await updateSeedGroupCount(seedGroupId, remaining.length);
      }
    }

    // Remove the account metadata
    await removeAccount(accountId);

    // Notify UI of account update
    chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove account",
    };
  }
}

/**
 * Performs a full security reset - clears ALL sensitive data from memory
 * This should be called when resetting the extension
 */
export function performSecurityReset(): void {
  // Abort all active transactions
  for (const [, abortController] of activeAbortControllers.entries()) {
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors
    }
  }
  activeAbortControllers.clear();

  // Reject all pending resolvers with reset error
  for (const [, resolver] of pendingResolvers.entries()) {
    try {
      resolver.resolve({ success: false, error: "Extension was reset" });
    } catch {
      // Ignore errors
    }
  }
  pendingResolvers.clear();

  // Reject all pending signature resolvers with reset error
  for (const [, resolver] of pendingSignatureResolvers.entries()) {
    try {
      resolver.resolve({ success: false, error: "Extension was reset" });
    } catch {
      // Ignore errors
    }
  }
  pendingSignatureResolvers.clear();

  // Clear failed transaction results
  failedTxResults.clear();
}

/**
 * Handles transfer initiated from within the extension UI (not from a dapp).
 * Creates a PendingTxRequest and notifies the UI to show TransactionConfirmation.
 */
export async function handleInitiateTransfer(
  message: {
    tx: TransactionParams;
    chainName: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const { tx, chainName } = message;

  // Validate chain ID
  if (!ALLOWED_CHAIN_IDS.has(tx.chainId)) {
    return {
      success: false,
      error: `Chain ${tx.chainId} not supported`,
    };
  }

  const txId = crypto.randomUUID();

  const pendingRequest: PendingTxRequest = {
    id: txId,
    tx,
    origin: "BankrWallet",
    favicon: null,
    chainName,
    timestamp: Date.now(),
  };

  await savePendingTxRequest(pendingRequest);

  // Notify extension UI about the new pending tx
  chrome.runtime.sendMessage({ type: "newPendingTxRequest", txRequest: pendingRequest }).catch(() => {});

  return { success: true, txId };
}

/**
 * Cancels a processing transaction by aborting the in-flight request.
 */
export async function handleCancelProcessingTx(
  txId: string
): Promise<{ success: boolean; error?: string }> {
  const controller = activeAbortControllers.get(txId);
  if (controller) {
    controller.abort();
    activeAbortControllers.delete(txId);
  }

  // Update history regardless (may already have been marked failed by the abort handler)
  const tx = await getTxById(txId);
  if (tx && tx.status === "processing") {
    await updateTxInHistory(txId, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
    });
  }

  return { success: true };
}
