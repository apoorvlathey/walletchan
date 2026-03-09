"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { compareTokens } from "../data/compareTokens";
import { formatMarketCap } from "../utils/formatters";

export interface CompareResult {
  symbol: string;
  name: string;
  logo: string;
  marketCapRaw: number;
  marketCap: string;
  change24h: number | null;
  isOurs: boolean;
  network: string;
  poolAddress: string;
  website?: string;
}

const CACHE_KEY = "@wchan/compare_token_data";
const WCHAN_TTL = 5 * 60_000; // 5 min for our token
const OTHERS_TTL = 12 * 60 * 60_000; // 12 hours for other tokens
const REFRESH_INTERVAL = WCHAN_TTL; // poll at the faster interval
const DELAY_BETWEEN_BATCHES_MS = 5_000;
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 120_000;
const GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2/networks";

interface PoolData {
  marketCapRaw: number;
  change24h: number | null;
  volume24h: number;
  fetchedAt: number;
}

interface CachedPoolMap {
  pools: Record<string, PoolData>;
}

function loadCache(): Map<string, PoolData> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as CachedPoolMap;
    if (!parsed?.pools) return new Map();
    const map = new Map<string, PoolData>();
    for (const [k, v] of Object.entries(parsed.pools)) {
      map.set(k, v);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveCache(pools: Map<string, PoolData>) {
  try {
    const obj: Record<string, PoolData> = {};
    pools.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pools: obj }));
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildResults(poolDataMap: Map<string, PoolData>): CompareResult[] {
  const results: CompareResult[] = compareTokens.map((token) => {
    const pd = poolDataMap.get(token.poolAddress.toLowerCase());
    return {
      symbol: token.symbol,
      name: token.name,
      logo: token.logo,
      marketCapRaw: pd?.marketCapRaw ?? 0,
      marketCap: pd ? formatMarketCap(pd.marketCapRaw) : "",
      change24h: pd?.change24h ?? null,
      isOurs: token.isOurs ?? false,
      network: token.network,
      poolAddress: token.poolAddress,
      website: token.website,
    };
  });

  results.sort((a, b) => b.marketCapRaw - a.marketCapRaw);
  return results;
}

/** Returns tokens whose cached data is missing or stale */
function getStaleTokens(poolData: Map<string, PoolData>) {
  const now = Date.now();
  return compareTokens.filter((t) => {
    const pd = poolData.get(t.poolAddress.toLowerCase());
    if (!pd) return true; // missing
    const ttl = t.isOurs ? WCHAN_TTL : OTHERS_TTL;
    return now - pd.fetchedAt > ttl;
  });
}

interface GeckoPoolAttrs {
  address: string;
  market_cap_usd: string | null;
  fdv_usd: string | null;
  price_change_percentage: { h24?: string } | null;
  volume_usd: { h24?: string } | null;
}

export function useCompareData() {
  const poolDataRef = useRef<Map<string, PoolData>>(new Map());
  const [tokens, setTokens] = useState<CompareResult[]>(() =>
    buildResults(poolDataRef.current)
  );
  const cancelledRef = useRef(false);

  const initFromCache = useCallback(() => {
    const map = loadCache();
    if (map.size > 0) {
      poolDataRef.current = map;
      setTokens(buildResults(map));
      console.log(`[compare] loaded ${map.size} pools from cache`);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    initFromCache();

    async function fetchNetwork(
      network: string,
      networkTokens: typeof compareTokens
    ): Promise<boolean> {
      const addresses = networkTokens.map((t) => t.poolAddress).join(",");
      const url = `${GECKOTERMINAL_BASE}/${network}/pools/multi/${addresses}`;
      const symbols = networkTokens.map((t) => t.symbol).join(", ");
      console.log(`[compare] fetching ${network} (${symbols})...`);
      const res = await fetch(url);

      if (res.status === 429) {
        console.warn(`[compare] 429 rate limited on ${network}`);
        return false;
      }
      if (!res.ok) {
        console.warn(`[compare] ${res.status} error on ${network}`);
        return true;
      }

      const json = await res.json();
      const data: { attributes: GeckoPoolAttrs }[] = json.data ?? [];

      const poolMap = new Map<string, GeckoPoolAttrs>();
      for (const pool of data) {
        const addr = pool.attributes?.address?.toLowerCase();
        if (addr) poolMap.set(addr, pool.attributes);
      }

      const now = Date.now();
      let updated = false;
      for (const token of networkTokens) {
        const attrs = poolMap.get(token.poolAddress.toLowerCase());
        if (!attrs) continue;

        const mcapRaw =
          parseFloat(attrs.market_cap_usd || "0") > 0
            ? parseFloat(attrs.market_cap_usd!)
            : parseFloat(attrs.fdv_usd || "0");
        const h24Str = attrs.price_change_percentage?.h24;
        const change24h = h24Str != null ? parseFloat(h24Str) : null;
        const vol24hStr = attrs.volume_usd?.h24;
        const volume24h =
          vol24hStr != null ? parseFloat(vol24hStr) : 0;

        poolDataRef.current.set(token.poolAddress.toLowerCase(), {
          marketCapRaw: mcapRaw,
          change24h:
            change24h != null && !isNaN(change24h) ? change24h : null,
          volume24h: !isNaN(volume24h) ? volume24h : 0,
          fetchedAt: now,
        });
        updated = true;
      }

      if (updated && !cancelledRef.current) {
        console.log(
          `[compare] ✓ ${network} — updated ${networkTokens
            .filter((t) => poolMap.has(t.poolAddress.toLowerCase()))
            .map((t) => t.symbol)
            .join(", ")}`
        );
        setTokens(buildResults(poolDataRef.current));
      }
      return true;
    }

    async function runCycle() {
      const stale = getStaleTokens(poolDataRef.current);
      if (stale.length === 0) {
        console.log("[compare] all tokens fresh — skipping cycle");
        return;
      }

      // Group stale tokens by network
      const networkGroups = new Map<string, typeof compareTokens>();
      for (const token of stale) {
        const group = networkGroups.get(token.network) || [];
        group.push(token);
        networkGroups.set(token.network, group);
      }

      const queue = Array.from(networkGroups.entries());
      console.log(
        `[compare] fetching ${stale.map((t) => t.symbol).join(", ")} — ${queue.length} network(s): ${queue.map(([n]) => n).join(", ")}`
      );
      let backoffMs = 0;
      let isFirst = true;

      while (queue.length > 0) {
        if (cancelledRef.current) return;

        if (!isFirst) {
          await sleep(backoffMs > 0 ? backoffMs : DELAY_BETWEEN_BATCHES_MS);
          if (cancelledRef.current) return;
        }
        isFirst = false;

        const [network, networkTokens] = queue[0];

        try {
          const ok = await fetchNetwork(network, networkTokens);
          if (ok) {
            queue.shift();
            backoffMs = 0;
          } else {
            backoffMs = Math.min(
              backoffMs === 0 ? BACKOFF_BASE_MS : backoffMs * 2,
              BACKOFF_MAX_MS
            );
            console.log(
              `[compare] will retry ${network} in ${(backoffMs / 1000).toFixed(0)}s (${queue.length} remaining)`
            );
          }
        } catch (err) {
          backoffMs = Math.min(
            backoffMs === 0 ? BACKOFF_BASE_MS : backoffMs * 2,
            BACKOFF_MAX_MS
          );
          console.warn(
            `[compare] fetch error on ${network} (likely 429 CORS), retry in ${(backoffMs / 1000).toFixed(0)}s:`,
            err
          );
          if (backoffMs >= BACKOFF_MAX_MS) {
            console.error(
              `[compare] giving up on ${network} after max backoff`
            );
            queue.shift();
            backoffMs = 0;
          }
        }
      }

      if (!cancelledRef.current && poolDataRef.current.size > 0) {
        saveCache(poolDataRef.current);
        console.log(
          `[compare] cycle complete — ${poolDataRef.current.size} pools cached`
        );
      }
    }

    // Initial fetch
    runCycle();

    // Poll at WCHAN interval — runCycle only fetches stale tokens
    const interval = setInterval(() => {
      if (!cancelledRef.current) runCycle();
    }, REFRESH_INTERVAL);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [initFromCache]);

  // WCHAN-specific stats for FOMO meter
  const wchanPool = compareTokens.find((t) => t.isOurs);
  const wchanData = wchanPool
    ? poolDataRef.current.get(wchanPool.poolAddress.toLowerCase())
    : undefined;
  const wchanMarketCap = wchanData?.marketCapRaw ?? 0;
  const wchanVolume24h = wchanData?.volume24h ?? 0;

  return { tokens, wchanMarketCap, wchanVolume24h };
}
