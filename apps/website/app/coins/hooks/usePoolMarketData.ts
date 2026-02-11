"use client";

import { useState, useEffect, useRef } from "react";
import { formatMarketCap } from "../../utils/formatters";
import type { Coin } from "./useCoinsStream";

const GECKOTERMINAL_BASE =
  "https://api.geckoterminal.com/api/v2/networks/base/pools/multi";
const BATCH_SIZE = 6; // small batches to stay under rate limits
const DELAY_BETWEEN_BATCHES_MS = 4_000; // 4s between each batch
const CYCLE_PAUSE_MS = 20_000; // 20s pause after a full cycle
const MAX_POOLS = 30; // only fetch data for the newest 30 coins
const BACKOFF_BASE_MS = 10_000; // base backoff on 429
const BACKOFF_MAX_MS = 120_000; // max backoff

export interface PoolMarketData {
  marketCap: string;
  marketCapRaw: number;
  change5m: number | null;
}

interface GeckoPoolAttrs {
  address: string;
  market_cap_usd: string | null;
  fdv_usd: string | null;
  price_change_percentage: { m5?: string } | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches market data from GeckoTerminal for coins with poolIds.
 *
 * Rate-limit strategy:
 * - Takes the first MAX_POOLS unique poolIds (newest coins first)
 * - Fetches in small batches of BATCH_SIZE with DELAY_BETWEEN_BATCHES_MS gaps
 * - After cycling through all batches, pauses CYCLE_PAUSE_MS before restarting
 * - On 429, backs off exponentially before retrying
 * - Merges results incrementally (stale data preserved on error)
 */
export function usePoolMarketData(coins: Coin[]): Map<string, PoolMarketData> {
  const [data, setData] = useState<Map<string, PoolMarketData>>(new Map());
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function fetchBatch(
      poolIds: string[]
    ): Promise<{ ok: boolean; pools: GeckoPoolAttrs[] }> {
      const addresses = poolIds.join(",");
      try {
        const res = await fetch(`${GECKOTERMINAL_BASE}/${addresses}`);
        if (res.status === 429) {
          return { ok: false, pools: [] };
        }
        if (!res.ok) return { ok: true, pools: [] }; // non-429 error, skip
        const json = await res.json();
        const pools = (json.data ?? []).map(
          (p: { attributes: GeckoPoolAttrs }) => p.attributes
        );
        return { ok: true, pools };
      } catch {
        return { ok: true, pools: [] }; // network error, skip batch
      }
    }

    function parsePool(attrs: GeckoPoolAttrs): [string, PoolMarketData] | null {
      const address = attrs.address?.toLowerCase();
      if (!address) return null;

      const mcapRaw =
        parseFloat(attrs.market_cap_usd || "0") > 0
          ? parseFloat(attrs.market_cap_usd!)
          : parseFloat(attrs.fdv_usd || "0");

      const change5mStr = attrs.price_change_percentage?.m5;
      const change5m =
        change5mStr != null ? parseFloat(change5mStr) : null;

      return [
        address,
        {
          marketCap: formatMarketCap(mcapRaw),
          marketCapRaw: mcapRaw,
          change5m: change5m != null && !isNaN(change5m) ? change5m : null,
        },
      ];
    }

    async function runCycle() {
      let backoffMs = 0;

      while (!cancelledRef.current) {
        // Collect unique poolIds from current coins (newest first)
        const seen = new Set<string>();
        const poolIds: string[] = [];
        for (const coin of coinsRef.current) {
          if (coin.poolId) {
            const id = coin.poolId.toLowerCase();
            if (!seen.has(id)) {
              seen.add(id);
              poolIds.push(id);
              if (poolIds.length >= MAX_POOLS) break;
            }
          }
        }

        if (poolIds.length === 0) {
          // No pools yet, wait and retry
          await sleep(CYCLE_PAUSE_MS);
          continue;
        }

        // Split into batches
        const batches: string[][] = [];
        for (let i = 0; i < poolIds.length; i += BATCH_SIZE) {
          batches.push(poolIds.slice(i, i + BATCH_SIZE));
        }

        // Fetch batches sequentially with delays
        for (const batch of batches) {
          if (cancelledRef.current) return;

          // If we're backing off from a 429, wait first
          if (backoffMs > 0) {
            await sleep(backoffMs);
            if (cancelledRef.current) return;
          }

          const result = await fetchBatch(batch);

          if (!result.ok) {
            // 429 — exponential backoff
            backoffMs = Math.min(
              backoffMs === 0 ? BACKOFF_BASE_MS : backoffMs * 2,
              BACKOFF_MAX_MS
            );
            break; // stop this cycle, will retry after backoff
          }

          // Success — reset backoff
          backoffMs = 0;

          if (result.pools.length > 0) {
            const updates: [string, PoolMarketData][] = [];
            for (const attrs of result.pools) {
              const parsed = parsePool(attrs);
              if (parsed) updates.push(parsed);
            }

            if (updates.length > 0) {
              setData((prev) => {
                const merged = new Map(prev);
                for (const [key, value] of updates) {
                  merged.set(key, value);
                }
                return merged;
              });
            }
          }

          // Delay before next batch (skip if last batch)
          if (batch !== batches[batches.length - 1]) {
            await sleep(DELAY_BETWEEN_BATCHES_MS);
          }
        }

        // Pause between full cycles
        if (!cancelledRef.current) {
          await sleep(backoffMs > 0 ? backoffMs : CYCLE_PAUSE_MS);
        }
      }
    }

    runCycle();

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return data;
}
