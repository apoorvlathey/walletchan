/**
 * Encryption utilities for secure API key storage
 * Uses PBKDF2 for key derivation and AES-256-GCM for encryption
 */

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Derives an AES-256-GCM key from a password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data using AES-256-GCM
 */
export async function encrypt(
  plaintext: string,
  password: string
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Decrypts data using AES-256-GCM
 */
export async function decrypt(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  const decoder = new TextDecoder();
  const salt = base64ToUint8Array(encryptedData.salt);
  const iv = base64ToUint8Array(encryptedData.iv);
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Saves encrypted API key to chrome storage
 */
export async function saveEncryptedApiKey(
  apiKey: string,
  password: string
): Promise<void> {
  const encryptedData = await encrypt(apiKey, password);
  await chrome.storage.local.set({ encryptedApiKey: encryptedData });
}

/**
 * Loads and decrypts API key from chrome storage
 */
export async function loadDecryptedApiKey(
  password: string
): Promise<string | null> {
  const { encryptedApiKey } = (await chrome.storage.local.get(
    "encryptedApiKey"
  )) as { encryptedApiKey: EncryptedData | undefined };

  if (!encryptedApiKey) {
    return null;
  }

  try {
    return await decrypt(encryptedApiKey, password);
  } catch {
    // Decryption failed - likely wrong password
    return null;
  }
}

/**
 * Checks if an encrypted API key exists in storage
 */
export async function hasEncryptedApiKey(): Promise<boolean> {
  const { encryptedApiKey } = await chrome.storage.local.get("encryptedApiKey");
  return !!encryptedApiKey;
}

/**
 * Removes the encrypted API key from storage
 */
export async function removeEncryptedApiKey(): Promise<void> {
  await chrome.storage.local.remove("encryptedApiKey");
}

// Utility functions for base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return base64ToUint8Array(base64).buffer as ArrayBuffer;
}
