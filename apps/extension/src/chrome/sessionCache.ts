/**
 * Session cache management for the background service worker
 * Manages all credential caching, session persistence, and auto-lock logic
 *
 * CRITICAL: Private keys and API keys only exist in memory here.
 * They are never stored unencrypted or transmitted outside the service worker.
 */

import type { DecryptedEntry, PasswordType } from "./types";

// Session cache for decrypted API key and password (cleared on restart/suspend)
let cachedApiKey: string | null = null;
let cachedPassword: string | null = null;
let cacheTimestamp: number = 0;

// Session cache for decrypted vault entries (cleared on restart/suspend)
// CRITICAL: Private keys only exist here in memory, never sent via messages
let cachedVault: DecryptedEntry[] | null = null;
let vaultCacheTimestamp: number = 0;

// Session cache for password type (master or agent)
// Used to restrict certain operations (like private key reveal) for agent sessions
let cachedPasswordType: PasswordType | null = null;

// Session cache for decrypted vault key
// This is the intermediate key that decrypts actual data (API key, private keys)
let cachedVaultKey: CryptoKey | null = null;

// Session ID for tracking active sessions across service worker restarts
// Used with chrome.storage.session for session restoration when auto-lock is "Never"
let currentSessionId: string | null = null;

// UI connection tracking for auto-lock
// While any popup/sidepanel is connected, the cache never expires
let activeUIConnections = 0;

// Auto-lock timeout configuration
export const DEFAULT_AUTO_LOCK_TIMEOUT = 0; // Never (infinite) by default
export const AUTO_LOCK_STORAGE_KEY = "autoLockTimeout";
let cachedAutoLockTimeout: number | null = null;

// Valid auto-lock timeout values (in milliseconds)
export const VALID_AUTO_LOCK_TIMEOUTS = new Set([
  60000,      // 1 minute
  300000,     // 5 minutes
  900000,     // 15 minutes
  1800000,    // 30 minutes
  3600000,    // 1 hour
  14400000,   // 4 hours
  0,          // Never (default)
]);

/**
 * Gets the auto-lock timeout from storage (with caching)
 */
export async function getAutoLockTimeout(): Promise<number> {
  if (cachedAutoLockTimeout !== null) {
    return cachedAutoLockTimeout;
  }
  const result = await chrome.storage.sync.get(AUTO_LOCK_STORAGE_KEY);
  const timeout = result[AUTO_LOCK_STORAGE_KEY] ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  cachedAutoLockTimeout = timeout;
  return timeout;
}

/**
 * Sets the auto-lock timeout in storage
 * Returns false if the timeout value is not in the allowed list
 */
export async function setAutoLockTimeout(timeout: number): Promise<boolean> {
  if (!VALID_AUTO_LOCK_TIMEOUTS.has(timeout)) {
    return false;
  }

  const previousTimeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  await chrome.storage.sync.set({ [AUTO_LOCK_STORAGE_KEY]: timeout });
  cachedAutoLockTimeout = timeout;

  // Handle session storage based on auto-lock setting changes
  if (timeout !== 0 && previousTimeout === 0) {
    // Changed from "Never" to a timed setting - clear session storage
    await clearSessionStorage();
  } else if (timeout === 0 && previousTimeout !== 0 && (getCachedApiKey() !== null || getCachedVault() !== null)) {
    // Changed to "Never" while unlocked - store session for restoration
    const password = getCachedPassword();
    if (password) {
      currentSessionId = crypto.randomUUID();
      await storeSessionMetadata(currentSessionId, true);
      await storeSessionPassword(password);
    }
  }

  return true;
}

/**
 * Updates the cached auto-lock timeout (called from storage change listener)
 */
export function updateCachedAutoLockTimeout(newValue: number | undefined): void {
  cachedAutoLockTimeout = newValue ?? DEFAULT_AUTO_LOCK_TIMEOUT;
}

/**
 * Gets cached API key if still valid
 */
export function getCachedApiKey(): string | null {
  const timeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  // Skip timeout check while UI is open, or if timeout is 0 ("Never")
  if (cachedApiKey && (activeUIConnections > 0 || timeout === 0 || Date.now() - cacheTimestamp < timeout)) {
    return cachedApiKey;
  }
  cachedApiKey = null;
  cachedPassword = null;
  return null;
}

/**
 * Gets cached password if still valid
 */
export function getCachedPassword(): string | null {
  const timeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  // Skip timeout check while UI is open, or if timeout is 0 ("Never")
  if (cachedPassword && (activeUIConnections > 0 || timeout === 0 || Date.now() - cacheTimestamp < timeout)) {
    return cachedPassword;
  }
  cachedPassword = null;
  return null;
}

/**
 * Caches the decrypted API key and password
 */
export function setCachedApiKey(apiKey: string, password?: string): void {
  cachedApiKey = apiKey;
  if (password) {
    cachedPassword = password;
  }
  cacheTimestamp = Date.now();
}

/**
 * Sets the cached API key directly (without updating password/timestamp)
 * Used during unlock flows where password is set separately
 */
export function setCachedApiKeyDirect(apiKey: string): void {
  cachedApiKey = apiKey;
}

/**
 * Sets the cached password directly (without updating API key)
 * Used during unlock flows
 */
export function setCachedPasswordDirect(password: string): void {
  cachedPassword = password;
  cacheTimestamp = Date.now();
}

/**
 * Clears the cached API key, password, vault key, and password type
 */
export function clearCachedApiKey(): void {
  cachedApiKey = null;
  cachedPassword = null;
  cachedPasswordType = null;
  cachedVaultKey = null;
  cacheTimestamp = 0;
}

/**
 * Gets cached vault if still valid
 */
export function getCachedVault(): DecryptedEntry[] | null {
  const timeout = cachedAutoLockTimeout ?? DEFAULT_AUTO_LOCK_TIMEOUT;
  // Skip timeout check while UI is open, or if timeout is 0 ("Never")
  if (cachedVault && (activeUIConnections > 0 || timeout === 0 || Date.now() - vaultCacheTimestamp < timeout)) {
    return cachedVault;
  }
  cachedVault = null;
  return null;
}

/**
 * Caches the decrypted vault entries
 */
export function setCachedVault(vault: DecryptedEntry[]): void {
  cachedVault = vault;
  vaultCacheTimestamp = Date.now();
}

/**
 * Clears the cached vault
 */
export function clearCachedVault(): void {
  cachedVault = null;
  vaultCacheTimestamp = 0;
}

/**
 * Gets cached vault key
 */
export function getCachedVaultKey(): CryptoKey | null {
  return cachedVaultKey;
}

/**
 * Sets cached vault key
 */
export function setCachedVaultKey(key: CryptoKey): void {
  cachedVaultKey = key;
}

/**
 * Gets cached password type
 */
export function getPasswordType(): PasswordType | null {
  return cachedPasswordType;
}

/**
 * Sets cached password type
 */
export function setCachedPasswordType(type: PasswordType): void {
  cachedPasswordType = type;
}

/**
 * Gets the current session ID
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

/**
 * Sets the current session ID
 */
export function setCurrentSessionId(id: string | null): void {
  currentSessionId = id;
}

/**
 * Stores encrypted session password in chrome.storage.session for session restoration.
 * Only used when auto-lock is "Never" to allow seamless session recovery after
 * service worker restarts.
 *
 * Security: The password is encrypted with a random key that is also stored in
 * session storage. This provides protection against simple session storage reads
 * while still allowing session restoration. The session storage is cleared when
 * the browser closes or user manually locks.
 */
export async function storeSessionPassword(password: string): Promise<void> {
  const sessionKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey("raw", sessionKey, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(password);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  await chrome.storage.session.set({
    encryptedSessionPassword: {
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      key: btoa(String.fromCharCode(...sessionKey)),
      iv: btoa(String.fromCharCode(...iv)),
    },
  });
}

/**
 * Retrieves and decrypts the session password from chrome.storage.session.
 * Returns null if no session password is stored or decryption fails.
 */
export async function getSessionPassword(): Promise<string | null> {
  const session = await chrome.storage.session.get("encryptedSessionPassword");
  if (!session.encryptedSessionPassword) {
    return null;
  }

  try {
    const { data, key: keyB64, iv: ivB64 } = session.encryptedSessionPassword;

    // Decode base64
    const encryptedData = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const sessionKey = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey("raw", sessionKey, "AES-GCM", false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Stores session metadata in chrome.storage.session.
 * Called after successful unlock when auto-lock is "Never".
 */
export async function storeSessionMetadata(sessionId: string, autoLockNever: boolean): Promise<void> {
  await chrome.storage.session.set({
    sessionId,
    sessionStartedAt: Date.now(),
    autoLockNever,
  });
}

/**
 * Clears all session data from chrome.storage.session.
 * Called when user manually locks or session expires.
 */
export async function clearSessionStorage(): Promise<void> {
  currentSessionId = null;
  await chrome.storage.session.clear();
}

/**
 * Attempts to restore a session after service worker restart.
 * Only works when auto-lock is "Never" and session data exists.
 * Returns true if session was successfully restored.
 *
 * @param unlockFn - The unlock function to call with the stored password
 */
export async function tryRestoreSession(
  unlockFn: (password: string) => Promise<{ success: boolean }>
): Promise<boolean> {
  const session = await chrome.storage.session.get([
    "sessionId",
    "autoLockNever",
    "encryptedSessionPassword",
  ]);

  // Check if we have a valid session to restore
  if (!session.sessionId || !session.autoLockNever || !session.encryptedSessionPassword) {
    return false;
  }

  try {
    // Get the session password
    const password = await getSessionPassword();
    if (!password) {
      await clearSessionStorage();
      return false;
    }

    // Try to unlock with the stored password
    const result = await unlockFn(password);
    if (!result.success) {
      await clearSessionStorage();
      return false;
    }

    // Restore session ID
    currentSessionId = session.sessionId;

    // Re-store the session password for future restarts
    await storeSessionPassword(password);

    console.log("Session restored successfully after service worker restart");
    return true;
  } catch (error) {
    console.error("Failed to restore session:", error);
    await clearSessionStorage();
    return false;
  }
}

/**
 * Gets a private key from the cached vault
 */
export function getPrivateKeyFromCache(accountId: string): `0x${string}` | null {
  const vault = getCachedVault();
  if (!vault) {
    return null;
  }
  const entry = vault.find((e) => e.id === accountId);
  return entry?.privateKey || null;
}

/**
 * Checks if the API key is currently cached (no password needed)
 */
export function isApiKeyCached(): boolean {
  return getCachedApiKey() !== null;
}

/**
 * Checks if the wallet is unlocked (either API key or vault cached)
 */
export function isWalletUnlocked(): boolean {
  return getCachedApiKey() !== null || getCachedVault() !== null;
}

/**
 * Increments active UI connections count
 */
export function incrementUIConnections(): void {
  activeUIConnections++;
}

/**
 * Decrements active UI connections count and resets timestamps when all close
 */
export function decrementUIConnections(): void {
  activeUIConnections--;
  if (activeUIConnections <= 0) {
    activeUIConnections = 0;
    // Reset timestamps so the countdown starts fresh from now
    if (cachedApiKey) {
      cacheTimestamp = Date.now();
    }
    if (cachedVault) {
      vaultCacheTimestamp = Date.now();
    }
  }
}
