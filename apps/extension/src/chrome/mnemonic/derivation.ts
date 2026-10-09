/**
 * BIP39 mnemonic and BIP44 derivation utilities
 * 12-word mnemonics only (128-bit entropy)
 *
 * CRITICAL: Generation, validation, derivation, and persistence are invoked
 * through extension-only handlers. Settings generation returns the phrase to
 * trusted UI for backup before persistence. Fresh-wallet onboarding generates
 * and encrypts it in the worker with durable pending-backup metadata. Neither
 * path forwards recovery material to a webpage.
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { bytesToHex } from "../cryptoUtils";

const BIP44_ETH = "m/44'/60'/0'/0";

/**
 * Generate a new 12-word mnemonic (128-bit entropy)
 */
export function generateNewMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

/**
 * Validate a mnemonic phrase (must be exactly 12 words)
 */
export function isValidMnemonic(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12) return false;
  return validateMnemonic(mnemonic.trim(), wordlist);
}

/**
 * Validate explicit phrase input. Only the dedicated owner-bound onboarding
 * creation route supplies a worker-generated phrase with deferred backup.
 */
export function normalizeMnemonicForPersistence(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return isValidMnemonic(normalized) ? normalized : null;
}

/**
 * Derive a private key from a mnemonic at a given BIP44 index
 * Path: m/44'/60'/0'/0/{index}
 */
export function derivePrivateKey(mnemonic: string, index: number): `0x${string}` {
  if (!Number.isSafeInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new Error("Derivation index must be between 0 and 2147483647");
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(`${BIP44_ETH}/${index}`);

  if (!child.privateKey) {
    throw new Error(`Failed to derive key at index ${index}`);
  }

  return `0x${bytesToHex(child.privateKey)}` as `0x${string}`;
}
