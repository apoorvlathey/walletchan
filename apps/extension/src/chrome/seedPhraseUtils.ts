/**
 * BIP39 mnemonic and BIP44 derivation utilities
 * 12-word mnemonics only (128-bit entropy)
 *
 * CRITICAL: This module should ONLY be called from background.ts
 * Mnemonics must NEVER leave the background service worker context
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";

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
 * Derive a private key from a mnemonic at a given BIP44 index
 * Path: m/44'/60'/0'/0/{index}
 */
export function derivePrivateKey(mnemonic: string, index: number): `0x${string}` {
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(`${BIP44_ETH}/${index}`);

  if (!child.privateKey) {
    throw new Error(`Failed to derive key at index ${index}`);
  }

  return `0x${Buffer.from(child.privateKey).toString("hex")}` as `0x${string}`;
}
