import { resolveEnsIdentity } from "./ensUtils";

// ============================================================================
// Types
// ============================================================================

export interface EnsIdentityCacheEntry {
  name: string | null;
  avatar: string | null;
  resolvedAt: number; // Date.now()
}

export type EnsIdentityCache = Record<string, EnsIdentityCacheEntry>;

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY = "ensIdentityCache";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// ============================================================================
// Cache Utilities
// ============================================================================

export function isCacheValid(entry: EnsIdentityCacheEntry): boolean {
  return Date.now() - entry.resolvedAt < CACHE_DURATION;
}

export async function getEnsIdentityCache(): Promise<EnsIdentityCache> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  return (result[CACHE_KEY] as EnsIdentityCache) || {};
}

async function saveEnsIdentityCache(cache: EnsIdentityCache): Promise<void> {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function resolveAndCacheIdentity(
  address: string
): Promise<{ name: string | null; avatar: string | null }> {
  const lowerAddress = address.toLowerCase();

  const { name, avatar } = await resolveEnsIdentity(address);

  const cache = await getEnsIdentityCache();
  cache[lowerAddress] = { name, avatar, resolvedAt: Date.now() };
  await saveEnsIdentityCache(cache);

  return { name, avatar };
}
