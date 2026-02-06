/**
 * Account types and vault structures for multi-account support
 */

export type AccountType = "bankr" | "privateKey";

/**
 * Password type for unlock sessions
 * - master: Full access including private key reveal
 * - agent: Normal operations only, no private key reveal
 */
export type PasswordType = "master" | "agent";

export interface BaseAccount {
  id: string;           // UUID
  type: AccountType;
  address: string;      // 0x...
  displayName?: string; // Optional display name (ENS or custom)
  createdAt: number;    // Timestamp
}

export interface BankrAccount extends BaseAccount {
  type: "bankr";
}

export interface PrivateKeyAccount extends BaseAccount {
  type: "privateKey";
}

export type Account = BankrAccount | PrivateKeyAccount;

/**
 * Encrypted private key entry stored in chrome.storage.local
 * Uses ox Keystore format with scrypt KDF
 */
export interface VaultEntry {
  id: string;           // Account ID (matches Account.id)
  keystore: object;     // ox Keystore.Keystore (encrypted)
}

/**
 * Decrypted private key entry - only exists in background.ts memory
 * NEVER stored or transmitted outside background worker
 */
export interface DecryptedEntry {
  id: string;           // Account ID
  privateKey: `0x${string}`;
}

/**
 * Vault structure stored in chrome.storage.local
 */
export interface Vault {
  version: 1;
  entries: VaultEntry[];
}
