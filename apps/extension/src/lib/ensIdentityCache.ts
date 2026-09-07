import { withStorageLock } from "@/chrome/storage/lock";
import { getAddress, isAddress, type Address } from "viem";
import { resolveEnsIdentitiesBatch } from "./ensBatchIdentity";
import { resolveEnsIdentity, sanitizeResolvedName } from "./ensUtils";

// ============================================================================
// Types
// ============================================================================

export interface EnsIdentityCacheEntry {
  name: string | null;
  avatar: string | null;
  resolvedAt: number; // Date.now()
  /** A forward-resolved contact name was cached, but its avatar still needs lookup. */
  needsAvatar?: boolean;
  reverseVersion?: number;
}

export type EnsIdentityCache = Record<string, EnsIdentityCacheEntry>;

// ============================================================================
// Constants
// ============================================================================

export function ensIdentityKey(address: string, chainId = 1): string {
  return `${chainId}:${address.toLowerCase()}`;
}

const CACHE_KEY = "ensIdentityCache";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// ============================================================================
// Cache Utilities
// ============================================================================

export function isCacheValid(entry: EnsIdentityCacheEntry): boolean {
  return !entry.needsAvatar && Date.now() - entry.resolvedAt < CACHE_DURATION;
}

export async function getEnsIdentityCache(): Promise<EnsIdentityCache> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const raw = (result[CACHE_KEY] as EnsIdentityCache) || {};
  // Defense-in-depth: entries written before the unicode-sanitization patch may
  // still hold hazardous names. Re-sanitize on every read so legacy caches
  // can't bypass the new guard until the 6h TTL expires.
  for (const addr of Object.keys(raw)) {
    raw[addr] = { ...raw[addr], name: sanitizeResolvedName(raw[addr].name) };
    // Retry L2 misses cached before direct registrar fallback was available.
    if (!raw[addr].name && raw[addr].reverseVersion !== 2 && /^(10|8453|42161|59144|534352):/.test(addr)) {
      raw[addr].resolvedAt = 0;
    }
  }
  return raw;
}

async function saveEnsIdentityCache(entries: EnsIdentityCache): Promise<void> {
  await withStorageLock("local:ensIdentityCache", async () => {
    const cache = await getEnsIdentityCache();
    await chrome.storage.local.set({ [CACHE_KEY]: { ...cache, ...entries } });
  });
}

export async function resolveAndCacheIdentity(
  address: string,
  chainId = 1,
): Promise<{ name: string | null; avatar: string | null }> {
  const lowerAddress = ensIdentityKey(address, chainId);

  const { name, avatar } = await resolveEnsIdentity(address, chainId);

  await saveEnsIdentityCache({ [lowerAddress]: { name, avatar, reverseVersion: 2, resolvedAt: Date.now() } });

  return { name, avatar };
}

export async function resolveAndCacheIdentities(
  addresses: string[],
  chainId = 1,
): Promise<Map<string, { name: string | null; avatar: string | null }>> {
  const validAddresses = addresses
    .filter((address) => isAddress(address, { strict: false }))
    .map((address) => getAddress(address) as Address);
  if (validAddresses.length === 0) return new Map();

  const cache = await getEnsIdentityCache();
  const knownNames = new Map<string, string>();
  for (const address of validAddresses) {
    const entry = cache[ensIdentityKey(address, chainId)];
    if (!entry?.needsAvatar) continue;
    const name = sanitizeResolvedName(entry.name);
    if (name) knownNames.set(address.toLowerCase(), name);
  }

  const resolved = await resolveEnsIdentitiesBatch(validAddresses, knownNames, chainId);
  const resolvedAt = Date.now();
  const entries: EnsIdentityCache = {};
  for (const [address, identity] of resolved) {
    entries[ensIdentityKey(address, chainId)] = { ...identity, reverseVersion: 2, resolvedAt };
  }
  await saveEnsIdentityCache(entries);
  return resolved;
}

export async function cacheIdentityNameHint(address: string, name: string, chainId = 1): Promise<void> {
  const sanitizedName = sanitizeResolvedName(name.trim().toLowerCase());
  if (!isAddress(address, { strict: false }) || !sanitizedName) return;
  const lowerAddress = ensIdentityKey(getAddress(address), chainId);
  const cache = await getEnsIdentityCache();
  const existing = cache[lowerAddress];
  cache[lowerAddress] = {
    name: sanitizedName,
    avatar: existing?.name === sanitizedName ? existing.avatar : null,
    resolvedAt: Date.now(),
    needsAvatar: true,
  };
  await saveEnsIdentityCache({ [lowerAddress]: cache[lowerAddress] });
}
