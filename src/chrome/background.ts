/**
 * Background service worker for handling transactions
 * - Receives transaction requests from content script
 * - Opens confirmation popup
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

// Pending transactions waiting for user confirmation
interface PendingTransaction {
  id: string;
  tx: TransactionParams;
  origin: string;
  resolve: (result: TransactionResult) => void;
}

interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

const pendingTransactions = new Map<string, PendingTransaction>();

// Active transaction AbortControllers for cancellation
const activeAbortControllers = new Map<string, AbortController>();

// Active job IDs and API keys for cancellation via Bankr API
const activeJobs = new Map<string, { jobId: string; apiKey: string }>();

// Session cache for decrypted API key (cleared on restart/suspend)
let cachedApiKey: string | null = null;
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
  return null;
}

/**
 * Caches the decrypted API key
 */
function setCachedApiKey(apiKey: string): void {
  cachedApiKey = apiKey;
  cacheTimestamp = Date.now();
}

/**
 * Clears the cached API key
 */
function clearCachedApiKey(): void {
  cachedApiKey = null;
  cacheTimestamp = 0;
}

// Clear cache when service worker suspends
self.addEventListener("suspend", () => {
  clearCachedApiKey();
});

/**
 * Opens the confirmation popup window
 */
async function openConfirmationPopup(txId: string): Promise<void> {
  const width = 400;
  const height = 600;

  // Try to center the popup
  let left = 100;
  let top = 100;

  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.left !== undefined && currentWindow.width !== undefined) {
      left = Math.round(
        currentWindow.left + (currentWindow.width - width) / 2
      );
    }
    if (currentWindow.top !== undefined && currentWindow.height !== undefined) {
      top = Math.round(
        currentWindow.top + (currentWindow.height - height) / 2
      );
    }
  } catch {
    // Use defaults if unable to get current window
  }

  await chrome.windows.create({
    url: `confirmation.html?txId=${txId}`,
    type: "popup",
    width,
    height,
    left,
    top,
    focused: true,
  });
}

/**
 * Handles incoming transaction requests from content script
 */
async function handleTransactionRequest(
  message: {
    type: string;
    tx: TransactionParams;
    origin: string;
  },
  sendResponse: (response: TransactionResult) => void
): Promise<void> {
  const { tx, origin } = message;

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

  // Create pending transaction
  const txId = crypto.randomUUID();

  // Store the pending transaction with its resolver
  const pendingTx: PendingTransaction = {
    id: txId,
    tx,
    origin,
    resolve: sendResponse,
  };
  pendingTransactions.set(txId, pendingTx);

  // Open confirmation popup
  await openConfirmationPopup(txId);
}

/**
 * Handles confirmation from the popup
 */
async function handleConfirmTransaction(
  txId: string,
  password: string
): Promise<TransactionResult> {
  const pending = pendingTransactions.get(txId);
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
    // Cache the API key for future transactions
    setCachedApiKey(apiKey);
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
  const pending = pendingTransactions.get(txId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired" };
  }
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
 * Gets pending transaction details for the popup
 */
function getPendingTransaction(
  txId: string
): { tx: TransactionParams; origin: string; chainName: string } | null {
  const pending = pendingTransactions.get(txId);
  if (!pending) {
    return null;
  }
  return {
    tx: pending.tx,
    origin: pending.origin,
    chainName: CHAIN_NAMES[pending.tx.chainId] || `Chain ${pending.tx.chainId}`,
  };
}

/**
 * Checks if the API key is currently cached (no password needed)
 */
function isApiKeyCached(): boolean {
  return getCachedApiKey() !== null;
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "sendTransaction": {
      // Handle async response
      handleTransactionRequest(message, sendResponse);
      // Return true to indicate we will send response asynchronously
      return true;
    }

    case "getPendingTransaction": {
      const result = getPendingTransaction(message.txId);
      sendResponse(result);
      return false;
    }

    case "isApiKeyCached": {
      sendResponse(isApiKeyCached());
      return false;
    }

    case "confirmTransaction": {
      handleConfirmTransaction(message.txId, message.password).then(
        (result) => {
          // Send result back to content script
          const pending = pendingTransactions.get(message.txId);
          if (pending) {
            pending.resolve(result);
            pendingTransactions.delete(message.txId);
          }
          sendResponse(result);
        }
      );
      return true;
    }

    case "rejectTransaction": {
      const result = handleRejectTransaction(message.txId);
      const pending = pendingTransactions.get(message.txId);
      if (pending) {
        pending.resolve(result);
        pendingTransactions.delete(message.txId);
      }
      sendResponse(result);
      return false;
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
