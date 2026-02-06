/**
 * Background service worker - message router and Chrome event listeners
 *
 * All business logic has been extracted into focused modules:
 * - sessionCache.ts: Credential caching, session persistence, auto-lock
 * - authHandlers.ts: Wallet unlock, vault key system, password management
 * - txHandlers.ts: Transaction/signature requests, notifications
 * - chatHandlers.ts: Bankr AI chat prompt handling
 * - sidepanelManager.ts: Side panel detection and mode management
 */

import {
  encryptWithVaultKey,
} from "./crypto";
import {
  getAccounts,
  getAccountById,
  getActiveAccount,
  setActiveAccountId,
  getTabAccount,
  setTabAccount,
  addBankrAccount,
  addImpersonatorAccount,
  addSeedPhraseAccount,
  addSeedGroup,
  getSeedGroups,
  updateSeedGroupCount,
  updateAccountDisplayName,
} from "./accountStorage";
import {
  decryptAllKeys,
  addKeyToVault,
} from "./vaultCrypto";
import {
  generateNewMnemonic,
  isValidMnemonic,
  derivePrivateKey as deriveSeedPrivateKey,
} from "./seedPhraseUtils";
import {
  storeMnemonic,
  getMnemonic,
} from "./mnemonicStorage";
import { deriveAddress } from "./localSigner";
import {
  removePendingTxRequest,
  getPendingTxRequests,
  clearExpiredTxRequests,
  updateBadge,
} from "./pendingTxStorage";
import {
  removePendingSignatureRequest,
  getPendingSignatureRequests,
  clearExpiredSignatureRequests,
} from "./pendingSignatureStorage";
import {
  getTxHistory,
  getProcessingTxs,
  clearTxHistory,
} from "./txHistoryStorage";
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  addMessageToConversation,
  updateMessageInConversation,
} from "./chatStorage";

// Session & cache management
import {
  AUTO_LOCK_STORAGE_KEY,
  updateCachedAutoLockTimeout,
  getCachedApiKey,
  setCachedApiKeyDirect,
  clearCachedApiKey,
  getCachedPassword,
  setCachedVault,
  clearCachedVault,
  getCachedVaultKey,
  getPasswordType,
  getAutoLockTimeout,
  setAutoLockTimeout,
  isApiKeyCached,
  isWalletUnlocked,
  getPrivateKeyFromCache,
  getCurrentSessionId,
  clearSessionStorage,
  tryRestoreSession,
  incrementUIConnections,
  decrementUIConnections,
} from "./sessionCache";

// Auth handlers
import {
  handleUnlockWallet,
  handleSetAgentPassword,
  handleRemoveAgentPassword,
  handleSaveApiKeyWithCachedPassword,
  handleChangePasswordWithCachedPassword,
} from "./authHandlers";

// Transaction handlers
import {
  pendingResolvers,
  pendingSignatureResolvers,
  failedTxResults,
  handleTransactionRequest,
  handleSignatureRequest,
  handleConfirmTransaction,
  handleRejectTransaction,
  handleCancelTransaction,
  handleConfirmTransactionAsync,
  handleConfirmTransactionAsyncPK,
  handleConfirmSignatureRequest,
  handleAddPrivateKeyAccount,
  handleRemoveAccount,
  openPopupWindow,
  performSecurityReset,
  handleInitiateTransfer,
  handleCancelProcessingTx,
  SignatureResult,
} from "./txHandlers";

// Chat handlers
import { handleSubmitChatPrompt } from "./chatHandlers";

// Sidepanel management
import {
  isSidePanelSupported,
  getSidePanelMode,
  setSidePanelMode,
  initSidePanel,
} from "./sidepanelManager";

// Handles RPC requests proxied from inpage script (to bypass page CSP)
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

// ─── Chrome Event Listeners ──────────────────────────────────────────────────

// Listen for storage changes to update cached timeout and broadcast address changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "sync") {
    if (changes[AUTO_LOCK_STORAGE_KEY]) {
      updateCachedAutoLockTimeout(changes[AUTO_LOCK_STORAGE_KEY].newValue);
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

// Clear cache when service worker suspends
self.addEventListener("suspend", () => {
  clearCachedApiKey();
  clearCachedVault();
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

// Initialize sidepanel behavior on startup
initSidePanel();

// Port connection listener - used for waking up the service worker and UI keepalive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-wake") {
    // Just acknowledge the connection - the popup is waking us up
    console.log("Service worker woken up by popup");
  } else if (port.name === "ui-keepalive") {
    // UI view (popup/sidepanel/onboarding) connected - pause auto-lock timer
    incrementUIConnections();
    port.onDisconnect.addListener(() => {
      decrementUIConnections();
    });
  }
});

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "sendTransaction": {
      const senderWindowId = sender.tab?.windowId;
      handleTransactionRequest(message, sendResponse, senderWindowId);
      return true;
    }

    case "signatureRequest": {
      const senderWindowId = sender.tab?.windowId;
      handleSignatureRequest(message, sendResponse, senderWindowId);
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
      removePendingSignatureRequest(message.sigId).then(() => {
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
      (async () => {
        const { getPendingTxRequestById } = await import("./pendingTxStorage");
        const request = await getPendingTxRequestById(message.txId);
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
      })();
      return true;
    }

    case "isApiKeyCached": {
      sendResponse(isApiKeyCached());
      return false;
    }

    case "confirmTransaction": {
      handleConfirmTransaction(message.txId, message.password).then(
        async (result) => {
          await removePendingTxRequest(message.txId);
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
      removePendingTxRequest(message.txId).then(() => {
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
      return true;
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
      clearCachedVault();
      clearSessionStorage();
      sendResponse({ success: true });
      return false;
    }

    // Account management handlers
    case "getAccounts": {
      getAccounts().then((accounts) => {
        sendResponse(accounts);
      });
      return true;
    }

    case "getActiveAccount": {
      getActiveAccount().then((account) => {
        sendResponse(account);
      });
      return true;
    }

    case "setActiveAccount": {
      (async () => {
        await setActiveAccountId(message.accountId);
        const account = await getAccountById(message.accountId);
        if (account) {
          await chrome.storage.sync.set({
            address: account.address,
            displayAddress: account.displayName || account.address,
          });
        }
        chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
        sendResponse({ success: true });
      })();
      return true;
    }

    case "getTabAccount": {
      const tabId = message.tabId || sender.tab?.id;
      if (tabId) {
        getTabAccount(tabId).then((account) => {
          sendResponse(account);
        });
      } else {
        getActiveAccount().then((account) => {
          sendResponse(account);
        });
      }
      return true;
    }

    case "setTabAccount": {
      const tabId = message.tabId || sender.tab?.id;
      if (tabId) {
        setTabAccount(tabId, message.accountId).then(() => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: "No tab ID" });
      }
      return true;
    }

    case "addBankrAccount": {
      (async () => {
        try {
          // SECURITY: Block API key changes when unlocked with agent password
          if (message.apiKey && getPasswordType() === "agent") {
            sendResponse({ success: false, error: "Adding accounts with API keys requires master password" });
            return;
          }

          // If apiKey is provided and wallet is unlocked, save it first
          if (message.apiKey) {
            let password = getCachedPassword();

            // If no cached password, try session restoration (for "Never" auto-lock mode)
            if (!password) {
              const autoLockTimeout = await getAutoLockTimeout();
              if (autoLockTimeout === 0) {
                const restored = await tryRestoreSession(handleUnlockWallet);
                if (restored) {
                  password = getCachedPassword();
                }
              }
            }

            if (password) {
              const vaultKey = getCachedVaultKey();
              if (vaultKey) {
                const encrypted = await encryptWithVaultKey(vaultKey, message.apiKey);
                await chrome.storage.local.set({ encryptedApiKeyVault: encrypted });
              } else {
                const { saveEncryptedApiKey } = await import("./crypto");
                await saveEncryptedApiKey(message.apiKey, password);
              }
              setCachedApiKeyDirect(message.apiKey);
            }
          }

          const account = await addBankrAccount(message.address, message.displayName);
          chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
          sendResponse({ success: true, account });
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to add account" });
        }
      })();
      return true;
    }

    case "addImpersonatorAccount": {
      // SECURITY: Block when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Adding accounts requires master password" });
        return false;
      }
      (async () => {
        try {
          const account = await addImpersonatorAccount(message.address, message.displayName);
          chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
          sendResponse({ success: true, account });
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to add account" });
        }
      })();
      return true;
    }

    case "addSeedPhraseGroup": {
      // SECURITY: Block when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Adding seed phrases requires master password" });
        return false;
      }
      (async () => {
        try {
          let password = getCachedPassword();

          // If no cached password, try session restoration (for "Never" auto-lock mode)
          if (!password) {
            const autoLockTimeout = await getAutoLockTimeout();
            if (autoLockTimeout === 0) {
              const restored = await tryRestoreSession(handleUnlockWallet);
              if (restored) {
                password = getCachedPassword();
              }
            }
          }

          if (!password) {
            sendResponse({ success: false, error: "Wallet must be unlocked" });
            return;
          }

          // Generate or validate mnemonic
          let mnemonic: string;
          if (message.mnemonic) {
            if (!isValidMnemonic(message.mnemonic)) {
              sendResponse({ success: false, error: "Invalid seed phrase (must be 12 words)" });
              return;
            }
            mnemonic = message.mnemonic.trim();
          } else {
            mnemonic = generateNewMnemonic();
          }

          // Create seed group
          const group = await addSeedGroup(message.name);

          // Encrypt and store mnemonic
          await storeMnemonic(group.id, mnemonic, password);

          // Derive first account (index 0)
          const privateKey = deriveSeedPrivateKey(mnemonic, 0);
          const address = deriveAddress(privateKey);

          // Add account metadata first (to get the UUID)
          const account = await addSeedPhraseAccount(address, group.id, 0);
          await updateSeedGroupCount(group.id, 1);

          // Store derived PK in vault using account UUID (matches vault lookup)
          await addKeyToVault(account.id, privateKey, password);

          // Update cached vault
          const vault = await decryptAllKeys(password);
          if (vault) setCachedVault(vault);

          chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
          sendResponse({
            success: true,
            account,
            group,
            mnemonic: message.mnemonic ? undefined : mnemonic, // Only return if generated
          });
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to create seed phrase" });
        }
      })();
      return true;
    }

    case "deriveSeedAccount": {
      // SECURITY: Block when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Deriving accounts requires master password" });
        return false;
      }
      (async () => {
        try {
          let password = getCachedPassword();

          // If no cached password, try session restoration (for "Never" auto-lock mode)
          if (!password) {
            const autoLockTimeout = await getAutoLockTimeout();
            if (autoLockTimeout === 0) {
              const restored = await tryRestoreSession(handleUnlockWallet);
              if (restored) {
                password = getCachedPassword();
              }
            }
          }

          if (!password) {
            sendResponse({ success: false, error: "Wallet must be unlocked" });
            return;
          }

          const { seedGroupId } = message;
          const mnemonic = await getMnemonic(seedGroupId, password);
          if (!mnemonic) {
            sendResponse({ success: false, error: "Seed phrase not found or wrong password" });
            return;
          }

          // Find next index
          const accounts = await getAccounts();
          const groupAccounts = accounts.filter(
            (a) => a.type === "seedPhrase" && (a as any).seedGroupId === seedGroupId
          );
          const nextIndex = groupAccounts.length > 0
            ? Math.max(...groupAccounts.map((a) => (a as any).derivationIndex)) + 1
            : 0;

          // Derive key
          const privateKey = deriveSeedPrivateKey(mnemonic, nextIndex);
          const address = deriveAddress(privateKey);

          // Add account first (to get UUID)
          const account = await addSeedPhraseAccount(address, seedGroupId, nextIndex);
          await updateSeedGroupCount(seedGroupId, groupAccounts.length + 1);

          // Store in vault using account UUID (matches vault lookup)
          await addKeyToVault(account.id, privateKey, password);

          // Update cached vault
          const vault = await decryptAllKeys(password);
          if (vault) setCachedVault(vault);

          chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
          sendResponse({ success: true, account });
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to derive account" });
        }
      })();
      return true;
    }

    case "revealSeedPhrase": {
      // SECURITY: Block when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Revealing seed phrase requires master password" });
        return false;
      }
      (async () => {
        try {
          let password = getCachedPassword();

          // If no cached password, try session restoration (for "Never" auto-lock mode)
          if (!password) {
            const autoLockTimeout = await getAutoLockTimeout();
            if (autoLockTimeout === 0) {
              const restored = await tryRestoreSession(handleUnlockWallet);
              if (restored) {
                password = getCachedPassword();
              }
            }
          }

          if (!password) {
            sendResponse({ success: false, error: "Wallet must be unlocked" });
            return;
          }

          const mnemonic = await getMnemonic(message.seedGroupId, password);
          if (!mnemonic) {
            sendResponse({ success: false, error: "Seed phrase not found" });
            return;
          }

          sendResponse({ success: true, mnemonic });
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to reveal seed phrase" });
        }
      })();
      return true;
    }

    case "getSeedGroups": {
      getSeedGroups().then((groups) => {
        sendResponse(groups);
      });
      return true;
    }

    case "updateAccountDisplayName": {
      updateAccountDisplayName(message.accountId, message.displayName || "").then(() => {
        chrome.runtime.sendMessage({ type: "accountsUpdated" }).catch(() => {});
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error instanceof Error ? error.message : "Failed to update" });
      });
      return true;
    }

    case "addPrivateKeyAccount": {
      (async () => {
        // SECURITY: Block adding accounts when unlocked with agent password
        if (getPasswordType() === "agent") {
          sendResponse({ success: false, error: "Adding accounts requires master password" });
          return;
        }

        let password = message.password || getCachedPassword();

        if (!password) {
          const autoLockTimeout = await getAutoLockTimeout();
          if (autoLockTimeout === 0) {
            const restored = await tryRestoreSession(handleUnlockWallet);
            if (restored) {
              password = getCachedPassword();
            }
          }
        }

        if (!password) {
          sendResponse({ success: false, error: "Wallet is locked" });
          return;
        }

        const result = await handleAddPrivateKeyAccount(
          message.privateKey,
          password,
          message.displayName
        );
        sendResponse(result);
      })();
      return true;
    }

    case "removeAccount": {
      // SECURITY: Block account removal when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Account removal requires master password" });
        return false;
      }
      handleRemoveAccount(message.accountId).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "revealPrivateKey": {
      (async () => {
        try {
          const { accountId, password } = message;

          if (!getCachedPassword()) {
            const autoLockTimeout = await getAutoLockTimeout();
            if (autoLockTimeout === 0) {
              await tryRestoreSession(handleUnlockWallet);
            }
          }

          const cachedPwd = getCachedPassword();
          if (!cachedPwd) {
            sendResponse({ success: false, error: "Wallet is locked" });
            return;
          }

          // SECURITY: Block private key reveal when unlocked with agent password
          if (getPasswordType() === "agent") {
            sendResponse({
              success: false,
              error: "Private key reveal requires master password",
              requiresMasterPassword: true,
            });
            return;
          }

          if (password !== cachedPwd) {
            sendResponse({ success: false, error: "Invalid password" });
            return;
          }

          // Try cached vault first
          let privateKey = getPrivateKeyFromCache(accountId);
          if (!privateKey) {
            const vault = await decryptAllKeys(cachedPwd);
            if (!vault) {
              sendResponse({ success: false, error: "Failed to decrypt vault" });
              return;
            }
            setCachedVault(vault);
            privateKey = getPrivateKeyFromCache(accountId);
          }
          if (!privateKey) {
            sendResponse({ success: false, error: "Private key not found for this account" });
            return;
          }
          sendResponse({ success: true, privateKey });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Failed to reveal private key",
          });
        }
      })();
      return true;
    }

    case "confirmSignatureRequest": {
      const tabId = message.tabId || sender.tab?.id;
      handleConfirmSignatureRequest(message.sigId, message.password, tabId).then(
        (result) => {
          const resolver = pendingSignatureResolvers.get(message.sigId);
          if (resolver) {
            resolver.resolve(result);
            pendingSignatureResolvers.delete(message.sigId);
          }
          sendResponse(result);
        }
      );
      return true;
    }

    case "confirmTransactionAsyncPK": {
      const tabId = message.tabId || sender.tab?.id;
      handleConfirmTransactionAsyncPK(message.txId, message.password, tabId).then(
        (result) => {
          sendResponse(result);
        }
      );
      return true;
    }

    case "isWalletUnlocked": {
      (async () => {
        let unlocked = isWalletUnlocked();
        if (!unlocked) {
          const autoLockTimeout = await getAutoLockTimeout();
          if (autoLockTimeout === 0) {
            const restored = await tryRestoreSession(handleUnlockWallet);
            if (restored) {
              unlocked = true;
            }
          }
        }
        sendResponse(unlocked);
      })();
      return true;
    }

    case "validateSession": {
      sendResponse({
        valid: getCurrentSessionId() !== null && isWalletUnlocked(),
        sessionId: getCurrentSessionId(),
      });
      return false;
    }

    case "tryRestoreSession": {
      tryRestoreSession(handleUnlockWallet).then((restored) => {
        sendResponse(restored);
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
      (async () => {
        let hasCached = getCachedPassword() !== null;

        // If no cached password, try session restoration (for "Never" auto-lock mode)
        if (!hasCached) {
          const autoLockTimeout = await getAutoLockTimeout();
          if (autoLockTimeout === 0) {
            const restored = await tryRestoreSession(handleUnlockWallet);
            if (restored) {
              hasCached = getCachedPassword() !== null;
            }
          }
        }

        sendResponse({ hasCachedPassword: hasCached });
      })();
      return true;
    }

    case "changePasswordWithCachedPassword": {
      handleChangePasswordWithCachedPassword(message.newPassword).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "getCachedApiKey": {
      (async () => {
        let apiKey = getCachedApiKey();
        if (!apiKey) {
          const autoLockTimeout = await getAutoLockTimeout();
          if (autoLockTimeout === 0) {
            const restored = await tryRestoreSession(handleUnlockWallet);
            if (restored) {
              apiKey = getCachedApiKey();
            }
          }
        }
        sendResponse({ apiKey: apiKey || null });
      })();
      return true;
    }

    case "setAgentPassword": {
      handleSetAgentPassword(message.agentPassword).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "removeAgentPassword": {
      handleRemoveAgentPassword(message.masterPassword).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "isAgentPasswordEnabled": {
      (async () => {
        const { agentPasswordEnabled } = await chrome.storage.local.get("agentPasswordEnabled");
        sendResponse({ enabled: !!agentPasswordEnabled });
      })();
      return true;
    }

    case "getPasswordType": {
      sendResponse({ passwordType: getPasswordType() });
      return false;
    }

    case "rpcRequest": {
      handleRpcRequest(message.rpcUrl, message.method, message.params)
        .then((result) => sendResponse({ result }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }

    case "setArcBrowser": {
      if (message.isArc) {
        chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false, isArcBrowser: true });
        if (chrome.sidePanel?.setPanelBehavior) {
          chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
        }
      }
      sendResponse({ success: true });
      return false;
    }

    case "isSidePanelSupported": {
      (async () => {
        if (!isSidePanelSupported()) {
          sendResponse({ supported: false });
          return;
        }
        const { sidePanelVerified } = await chrome.storage.sync.get(["sidePanelVerified"]);
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

    case "initiateTransfer": {
      handleInitiateTransfer(message).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "cancelProcessingTx": {
      handleCancelProcessingTx(message.txId).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "getFailedTxResult": {
      const result = failedTxResults.get(message.notificationId);
      if (result) {
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
      chrome.runtime.sendMessage({ type: "onboardingComplete" }).catch(() => {});
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
      // SECURITY: Block extension reset when unlocked with agent password
      if (getPasswordType() === "agent") {
        sendResponse({ success: false, error: "Extension reset requires master password" });
        return false;
      }

      // SECURITY: Perform full memory cleanup first (before async operations)
      performSecurityReset();
      clearCachedApiKey();
      clearCachedVault();

      (async () => {
        try {
          const allLocalStorage = await chrome.storage.local.get(null);
          const notificationKeys = Object.keys(allLocalStorage).filter(
            (key) => key.startsWith("notification-")
          );

          await Promise.all([
            chrome.storage.local.remove([
              "encryptedApiKey",
              "txHistory",
              "pendingTxRequests",
              "pendingSignatureRequests",
              "chatHistory",
              "pkVault",
              "accounts",
              ...notificationKeys,
            ]),
            chrome.storage.sync.remove([
              "address",
              "displayAddress",
              "sidePanelVerified",
              "sidePanelMode",
              "activeAccountId",
              "tabAccounts",
            ]),
          ]);

          await chrome.action.setBadgeText({ text: "" });

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

    // Chat message handlers
    case "submitChatPrompt": {
      handleSubmitChatPrompt(
        message.conversationId,
        message.messageId,
        message.prompt
      ).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case "getChatConversations": {
      getConversations().then((conversations) => {
        sendResponse(conversations);
      });
      return true;
    }

    case "getChatConversation": {
      getConversation(message.conversationId).then((conversation) => {
        sendResponse(conversation);
      });
      return true;
    }

    case "createChatConversation": {
      createConversation(message.title).then((conversation) => {
        sendResponse(conversation);
      });
      return true;
    }

    case "deleteChatConversation": {
      deleteConversation(message.conversationId).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case "addChatMessage": {
      addMessageToConversation(message.conversationId, message.message).then(
        (conversation) => {
          sendResponse(conversation);
        }
      );
      return true;
    }

    case "updateChatMessage": {
      updateMessageInConversation(
        message.conversationId,
        message.messageId,
        message.updates
      ).then((conversation) => {
        sendResponse(conversation);
      });
      return true;
    }
  }

  return false;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const storageKey = `notification-${notificationId}`;
  const data = await chrome.storage.local.get([storageKey]);
  const notificationData = data[storageKey];

  if (notificationData) {
    if (typeof notificationData === "string") {
      chrome.tabs.create({ url: notificationData });
      chrome.storage.local.remove(storageKey);
    } else if (notificationData.type === "error") {
      const useSidePanel = await getSidePanelMode();

      if (useSidePanel && isSidePanelSupported()) {
        const popupUrl = chrome.runtime.getURL(`index.html?showError=${notificationData.txId}`);
        await chrome.windows.create({
          url: popupUrl,
          type: "popup",
          width: 360,
          height: 680,
          focused: true,
        });
      } else {
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

  chrome.notifications.clear(notificationId);
});

// Export for module
export {};
