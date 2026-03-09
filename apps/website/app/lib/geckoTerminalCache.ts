/**
 * Shared in-memory cache for GeckoTerminal pool data.
 *
 * Both /api/token-data and /api/vault-data need WCHAN pool data from
 * GeckoTerminal. Without a shared cache, simultaneous requests on page load
 * hit GeckoTerminal twice — the second gets rate-limited, returning bad data
 * that poisons downstream calculations (wethApy=0, tvlUsd=0).
 *
 * This module ensures only one actual GeckoTerminal request is in-flight
 * at a time, with a 5s TTL cache. Both routes import getWchanPoolData()
 * instead of calling fetch() directly.
 */
import { GECKOTERMINAL_API_URL } from "../constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedData: any = null;
let lastFetchedAt = 0;
let inflightPromise: Promise<any> | null = null;

const CACHE_TTL = 5_000; // 5 seconds

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWchanPoolData(): Promise<any> {
  const now = Date.now();

  // Serve from cache if fresh
  if (cachedData && now - lastFetchedAt < CACHE_TTL) {
    return cachedData;
  }

  // Deduplicate concurrent requests — if a fetch is already in progress,
  // all callers await the same promise instead of firing another request
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const res = await fetch(GECKOTERMINAL_API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
      const data = await res.json();
      cachedData = data;
      lastFetchedAt = Date.now();
      return data;
    } catch (error) {
      // Return stale data on failure rather than throwing
      if (cachedData) return cachedData;
      throw error;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
