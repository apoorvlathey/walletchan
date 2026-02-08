/**
 * Authentication and password management handlers
 * Handles wallet unlock, vault key system, password changes, and agent passwords
 */

import {
  loadDecryptedApiKey,
  hasEncryptedApiKey,
  generateVaultKey,
  encryptVaultKey,
  tryDecryptVaultKey,
  importVaultKey,
  encryptWithVaultKey,
  decryptWithVaultKey,
  EncryptedData,
} from "./crypto";
import {
  decryptAllKeys,
  reEncryptVault,
  hasVaultEntries,
} from "./vaultCrypto";
import { reEncryptMnemonicVault, hasMnemonics } from "./mnemonicStorage";
import type { PasswordType } from "./types";
import {
  setCachedApiKey,
  setCachedApiKeyDirect,
  setCachedPasswordDirect,
  clearCachedApiKey,
  getCachedPassword,
  setCachedVault,
  clearCachedVault,
  getCachedVaultKey,
  setCachedVaultKey,
  setCachedPasswordType,
  getPasswordType,
  setCurrentSessionId,
  getAutoLockTimeout,
  storeSessionMetadata,
  storeSessionPassword,
  tryRestoreSession,
} from "./sessionCache";

/**
 * Attempts to unlock the wallet by caching the decrypted API key and vault
 * Supports both legacy format (direct password encryption) and new vault key system
 * With vault key system, both master and agent passwords can unlock the wallet
 */
export async function handleUnlockWallet(password: string): Promise<{ success: boolean; error?: string; passwordType?: PasswordType }> {
  const hasVaultKeySystemActive = await checkHasVaultKeySystem();

  if (hasVaultKeySystemActive) {
    // New vault key system - try to decrypt vault key with either password
    return await unlockWithVaultKeySystem(password);
  } else {
    // Legacy system - decrypt directly with password, then migrate if successful
    return await unlockWithLegacySystem(password);
  }
}

/**
 * Checks if vault key system is in use
 */
export async function checkHasVaultKeySystem(): Promise<boolean> {
  const { encryptedVaultKeyMaster } = await chrome.storage.local.get("encryptedVaultKeyMaster");
  return !!encryptedVaultKeyMaster;
}

/**
 * Unlocks using the new vault key system
 * Tries master password first, then agent password
 */
async function unlockWithVaultKeySystem(password: string): Promise<{ success: boolean; error?: string; passwordType?: PasswordType }> {
  const { encryptedVaultKeyMaster, encryptedVaultKeyAgent, agentPasswordEnabled } =
    await chrome.storage.local.get(["encryptedVaultKeyMaster", "encryptedVaultKeyAgent", "agentPasswordEnabled"]);

  if (!encryptedVaultKeyMaster) {
    return { success: false, error: "No encrypted vault key found" };
  }

  let vaultKeyBytes: Uint8Array | null = null;
  let passwordType: PasswordType = "master";

  // Try master password first
  vaultKeyBytes = await tryDecryptVaultKey(encryptedVaultKeyMaster, password);

  // If master failed and agent password is enabled, try agent password
  if (!vaultKeyBytes && agentPasswordEnabled && encryptedVaultKeyAgent) {
    vaultKeyBytes = await tryDecryptVaultKey(encryptedVaultKeyAgent, password);
    if (vaultKeyBytes) {
      passwordType = "agent";
    }
  }

  if (!vaultKeyBytes) {
    return { success: false, error: "Invalid password" };
  }

  // Import the vault key
  const vaultKey = await importVaultKey(vaultKeyBytes);
  setCachedVaultKey(vaultKey);
  setCachedPasswordType(passwordType);

  // Always cache the password for session management
  setCachedPasswordDirect(password);

  // Decrypt API key using vault key (if exists)
  const { encryptedApiKeyVault } = await chrome.storage.local.get("encryptedApiKeyVault");
  if (encryptedApiKeyVault) {
    const apiKey = await decryptWithVaultKey(vaultKey, encryptedApiKeyVault);
    if (apiKey) {
      setCachedApiKeyDirect(apiKey);
    }
  }

  // Decrypt vault entries (private keys) using the vault key
  const hasVault = await hasVaultEntries();
  if (hasVault) {
    const vault = await decryptAllKeysWithVaultKey(vaultKey);
    if (vault) {
      setCachedVault(vault);
    }
  }

  // Store session data for restoration if auto-lock is "Never"
  const autoLockTimeout = await getAutoLockTimeout();
  if (autoLockTimeout === 0) {
    const sessionId = crypto.randomUUID();
    setCurrentSessionId(sessionId);
    await storeSessionMetadata(sessionId, true);
    await storeSessionPassword(password);
  }

  return { success: true, passwordType };
}

/**
 * Unlocks using legacy system (direct password encryption)
 * Also migrates to vault key system after successful unlock
 */
async function unlockWithLegacySystem(password: string): Promise<{ success: boolean; error?: string; passwordType?: PasswordType }> {
  // Try to decrypt API key (if exists)
  const hasApiKey = await hasEncryptedApiKey();
  let apiKey: string | null = null;

  if (hasApiKey) {
    apiKey = await loadDecryptedApiKey(password);
    if (!apiKey) {
      return { success: false, error: "Invalid password" };
    }
    setCachedApiKey(apiKey, password);
  }

  // Try to decrypt vault (if exists)
  const hasVault = await hasVaultEntries();
  if (hasVault) {
    const vault = await decryptAllKeys(password);
    if (!vault) {
      // If we already decrypted API key but vault fails, password is wrong
      // This shouldn't happen if passwords are in sync
      if (!hasApiKey) {
        return { success: false, error: "Invalid password" };
      }
    } else {
      setCachedVault(vault);
    }
  }

  // If we have neither API key nor vault, password can't be verified
  if (!hasApiKey && !hasVault) {
    return { success: false, error: "No encrypted data found" };
  }

  // Migration: Create vault key system
  await migrateToVaultKeySystem(password, apiKey);

  // Set password type to master (legacy system only has master password)
  setCachedPasswordType("master");

  // Store session data for restoration if auto-lock is "Never"
  const autoLockTimeout = await getAutoLockTimeout();
  if (autoLockTimeout === 0) {
    const sessionId = crypto.randomUUID();
    setCurrentSessionId(sessionId);
    await storeSessionMetadata(sessionId, true);
    await storeSessionPassword(password);
  }

  return { success: true, passwordType: "master" };
}

/**
 * Migrates from legacy direct-password encryption to vault key system
 */
async function migrateToVaultKeySystem(password: string, apiKey: string | null): Promise<void> {
  try {
    // Generate a new vault key
    const vaultKeyBytes = generateVaultKey();
    const vaultKey = await importVaultKey(vaultKeyBytes);

    // Encrypt vault key with master password
    const encryptedVaultKeyMaster = await encryptVaultKey(vaultKeyBytes, password);

    // Re-encrypt API key with vault key (if exists)
    let encryptedApiKeyVault: EncryptedData | null = null;
    if (apiKey) {
      encryptedApiKeyVault = await encryptWithVaultKey(vaultKey, apiKey);
    }

    // Save to storage
    const storageData: Record<string, any> = {
      encryptedVaultKeyMaster,
      agentPasswordEnabled: false,
    };
    if (encryptedApiKeyVault) {
      storageData.encryptedApiKeyVault = encryptedApiKeyVault;
    }
    await chrome.storage.local.set(storageData);

    // Cache the vault key
    setCachedVaultKey(vaultKey);

    console.log("Migration to vault key system completed");
  } catch (error) {
    console.error("Failed to migrate to vault key system:", error);
    // Continue without migration - will try again next unlock
  }
}

/**
 * Decrypts all private keys using the vault key
 * Note: This requires the vault entries to be re-encrypted with vault key
 * For now, falls back to password-based decryption during transition
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function decryptAllKeysWithVaultKey(_vaultKey: CryptoKey): Promise<import("./types").DecryptedEntry[] | null> {
  // During transition, the vault entries are still password-encrypted
  // We need to use the cached password to decrypt them
  const password = getCachedPassword();
  if (!password) {
    return [];
  }

  return await decryptAllKeys(password);
}

/**
 * Sets an agent password for the wallet
 * Requires the wallet to be unlocked with master password
 */
export async function handleSetAgentPassword(agentPassword: string): Promise<{ success: boolean; error?: string }> {
  // Must be unlocked with master password to set agent password
  if (getPasswordType() !== "master") {
    return { success: false, error: "Must be unlocked with master password to set agent password" };
  }

  if (!getCachedVaultKey()) {
    return { success: false, error: "Vault key not available. Please unlock the wallet first." };
  }

  if (!agentPassword || agentPassword.length < 6) {
    return { success: false, error: "Agent password must be at least 6 characters" };
  }

  try {
    // Get the vault key bytes by decrypting with master password
    const { encryptedVaultKeyMaster } = await chrome.storage.local.get("encryptedVaultKeyMaster");
    if (!encryptedVaultKeyMaster) {
      return { success: false, error: "No vault key found" };
    }

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
      return { success: false, error: "Session expired. Please unlock the wallet again." };
    }

    // Decrypt vault key with master password to get raw bytes
    const vaultKeyBytes = await tryDecryptVaultKey(encryptedVaultKeyMaster, password);
    if (!vaultKeyBytes) {
      return { success: false, error: "Failed to decrypt vault key" };
    }

    // Encrypt vault key with agent password
    const encryptedVaultKeyAgent = await encryptVaultKey(vaultKeyBytes, agentPassword);

    // Save to storage
    await chrome.storage.local.set({
      encryptedVaultKeyAgent,
      agentPasswordEnabled: true,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set agent password",
    };
  }
}

/**
 * Removes the agent password
 * Requires verification of master password
 */
export async function handleRemoveAgentPassword(masterPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify master password by trying to decrypt vault key
    const { encryptedVaultKeyMaster } = await chrome.storage.local.get("encryptedVaultKeyMaster");
    if (!encryptedVaultKeyMaster) {
      return { success: false, error: "No vault key found" };
    }

    const vaultKeyBytes = await tryDecryptVaultKey(encryptedVaultKeyMaster, masterPassword);
    if (!vaultKeyBytes) {
      return { success: false, error: "Invalid master password" };
    }

    // Remove agent password from storage
    await chrome.storage.local.remove("encryptedVaultKeyAgent");
    await chrome.storage.local.set({ agentPasswordEnabled: false });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove agent password",
    };
  }
}

/**
 * Saves a new API key using the currently cached password
 * This is used when changing API key while already unlocked
 */
export async function handleSaveApiKeyWithCachedPassword(
  newApiKey: string
): Promise<{ success: boolean; error?: string }> {
  // SECURITY: Block API key changes when unlocked with agent password
  if (getPasswordType() === "agent") {
    return { success: false, error: "API key changes require master password" };
  }

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
    return { success: false, error: "Wallet is locked. Please unlock first." };
  }

  try {
    // Check if vault key system is in use
    const vaultKey = getCachedVaultKey();
    if (vaultKey) {
      // Encrypt API key with vault key and save to new location
      const encrypted = await encryptWithVaultKey(vaultKey, newApiKey);
      await chrome.storage.local.set({ encryptedApiKeyVault: encrypted });
    } else {
      // Legacy system - encrypt with password
      const { saveEncryptedApiKey } = await import("./crypto");
      await saveEncryptedApiKey(newApiKey, password);
    }
    // Update the cached API key
    setCachedApiKeyDirect(newApiKey);
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
export async function handleChangePasswordWithCachedPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // SECURITY: Block password changes when unlocked with agent password
  if (getPasswordType() === "agent") {
    return { success: false, error: "Password changes require master password" };
  }

  let currentPassword = getCachedPassword();

  // If no cached password, try session restoration (for "Never" auto-lock mode)
  if (!currentPassword) {
    const autoLockTimeout = await getAutoLockTimeout();
    if (autoLockTimeout === 0) {
      const restored = await tryRestoreSession(handleUnlockWallet);
      if (restored) {
        currentPassword = getCachedPassword();
      }
    }
  }

  if (!currentPassword) {
    return { success: false, error: "Session expired. Please unlock your wallet again." };
  }

  try {
    // Check if using vault key system
    const hasVaultKeySystemActive = await checkHasVaultKeySystem();

    if (hasVaultKeySystemActive) {
      // New vault key system: re-encrypt the vault key with new password
      // The actual data (API key, private keys) stays encrypted with the vault key
      const { encryptedVaultKeyMaster } = await chrome.storage.local.get("encryptedVaultKeyMaster");
      if (!encryptedVaultKeyMaster) {
        return { success: false, error: "No vault key found" };
      }

      // Decrypt vault key with old password to get raw bytes
      const vaultKeyBytes = await tryDecryptVaultKey(encryptedVaultKeyMaster, currentPassword);
      if (!vaultKeyBytes) {
        return { success: false, error: "Failed to decrypt vault key" };
      }

      // Re-encrypt vault key with new password
      const newEncryptedVaultKeyMaster = await encryptVaultKey(vaultKeyBytes, newPassword);

      // Save the new encrypted vault key
      await chrome.storage.local.set({
        encryptedVaultKeyMaster: newEncryptedVaultKeyMaster,
      });

      // Re-encrypt private key vault entries (encrypted with password, not vault key)
      const hasVault = await hasVaultEntries();
      if (hasVault) {
        const success = await reEncryptVault(currentPassword, newPassword);
        if (!success) {
          return { success: false, error: "Failed to re-encrypt private key vault" };
        }
      }

      // Re-encrypt mnemonic vault entries (encrypted with password, not vault key)
      const hasMnemonicEntries = await hasMnemonics();
      if (hasMnemonicEntries) {
        const success = await reEncryptMnemonicVault(currentPassword, newPassword);
        if (!success) {
          return { success: false, error: "Failed to re-encrypt mnemonic vault" };
        }
      }

      // Note: encryptedVaultKeyAgent (if exists) stays unchanged - agent password remains valid
    } else {
      // Legacy system: re-encrypt data directly with new password
      const { loadDecryptedApiKey, saveEncryptedApiKey } = await import("./crypto");

      // Decrypt API key with cached password (if exists)
      const hasApiKey = await hasEncryptedApiKey();
      if (hasApiKey) {
        const apiKey = await loadDecryptedApiKey(currentPassword);
        if (!apiKey) {
          return { success: false, error: "Failed to decrypt API key" };
        }
        // Re-encrypt with new password
        await saveEncryptedApiKey(apiKey, newPassword);
      }

      // Re-encrypt the vault with new password (if exists)
      const hasVault = await hasVaultEntries();
      if (hasVault) {
        const success = await reEncryptVault(currentPassword, newPassword);
        if (!success) {
          return { success: false, error: "Failed to re-encrypt vault" };
        }
      }
    }

    // Clear the cache - user must unlock with new password
    clearCachedApiKey();
    clearCachedVault();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password"
    };
  }
}
