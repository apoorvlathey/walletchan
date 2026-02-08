/**
 * Encrypted mnemonic storage
 * Uses same PBKDF2 + AES-256-GCM pattern as vaultCrypto.ts
 *
 * CRITICAL: Only call decrypt functions from background.ts
 */

import {
  SALT_LENGTH,
  IV_LENGTH,
  arrayBufferToBase64,
  base64ToUint8Array,
  base64ToArrayBuffer,
  deriveKey,
} from "./cryptoUtils";

const MNEMONIC_VAULT_KEY = "mnemonicVault";

interface EncryptedMnemonic {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

export interface MnemonicVaultEntry {
  id: string; // seedGroupId
  keystore: EncryptedMnemonic;
}

interface MnemonicVault {
  version: 1;
  entries: MnemonicVaultEntry[];
}

/**
 * Encrypt a mnemonic phrase
 */
async function encryptMnemonic(
  mnemonic: string,
  password: string
): Promise<EncryptedMnemonic> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(mnemonic)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a mnemonic phrase
 * CRITICAL: Only call from background.ts
 */
async function decryptMnemonic(
  keystore: EncryptedMnemonic,
  password: string
): Promise<string> {
  const decoder = new TextDecoder();
  const salt = base64ToUint8Array(keystore.salt);
  const iv = base64ToUint8Array(keystore.iv);
  const ciphertext = base64ToArrayBuffer(keystore.ciphertext);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Load the mnemonic vault from storage
 */
async function loadMnemonicVault(): Promise<MnemonicVault | null> {
  const result = await chrome.storage.local.get(MNEMONIC_VAULT_KEY);
  return result[MNEMONIC_VAULT_KEY] || null;
}

/**
 * Save the mnemonic vault to storage
 */
async function saveMnemonicVault(vault: MnemonicVault): Promise<void> {
  await chrome.storage.local.set({ [MNEMONIC_VAULT_KEY]: vault });
}

/**
 * Store an encrypted mnemonic for a seed group
 */
export async function storeMnemonic(
  seedGroupId: string,
  mnemonic: string,
  password: string
): Promise<void> {
  let vault = await loadMnemonicVault();
  if (!vault) {
    vault = { version: 1, entries: [] };
  }

  // Check for duplicate
  if (vault.entries.some((e) => e.id === seedGroupId)) {
    throw new Error("Seed group already exists in vault");
  }

  const keystore = await encryptMnemonic(mnemonic, password);
  vault.entries.push({ id: seedGroupId, keystore });
  await saveMnemonicVault(vault);
}

/**
 * Retrieve and decrypt a mnemonic by seed group ID
 * CRITICAL: Only call from background.ts
 */
export async function getMnemonic(
  seedGroupId: string,
  password: string
): Promise<string | null> {
  const vault = await loadMnemonicVault();
  if (!vault) return null;

  const entry = vault.entries.find((e) => e.id === seedGroupId);
  if (!entry) return null;

  try {
    return await decryptMnemonic(entry.keystore, password);
  } catch {
    return null;
  }
}

/**
 * Remove a mnemonic entry from the vault
 */
export async function removeMnemonic(seedGroupId: string): Promise<void> {
  const vault = await loadMnemonicVault();
  if (!vault) return;

  vault.entries = vault.entries.filter((e) => e.id !== seedGroupId);
  await saveMnemonicVault(vault);
}

/**
 * Re-encrypts all mnemonic vault entries with a new password
 * Used when changing the wallet password
 */
export async function reEncryptMnemonicVault(
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const vault = await loadMnemonicVault();
  if (!vault || vault.entries.length === 0) {
    return true; // Nothing to re-encrypt
  }

  try {
    const newEntries: MnemonicVaultEntry[] = [];
    for (const entry of vault.entries) {
      // Decrypt with old password
      const mnemonic = await decryptMnemonic(entry.keystore, oldPassword);
      // Re-encrypt with new password
      const newKeystore = await encryptMnemonic(mnemonic, newPassword);
      newEntries.push({
        id: entry.id,
        keystore: newKeystore,
      });
    }

    // Save the re-encrypted vault
    vault.entries = newEntries;
    await saveMnemonicVault(vault);
    return true;
  } catch {
    // Failed to decrypt (wrong old password)
    return false;
  }
}

/**
 * Check if any mnemonics exist in the vault
 */
export async function hasMnemonics(): Promise<boolean> {
  const vault = await loadMnemonicVault();
  return !!vault && vault.entries.length > 0;
}
