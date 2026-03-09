/**
 * Consolidated vault data endpoint — single source of truth for sWCHAN vault APY,
 * TVL, and token prices. Consumed by VaultDataContext on the client.
 *
 * WHY THIS EXISTS:
 * Previously, VaultDataContext computed WETH APY client-side from 3 async sources
 * that raced on load: vault indexer, ETH price (CoinGecko), and WCHAN price
 * (TokenDataContext on a separate 5s poll). When wchanPrice hadn't loaded yet
 * (common on first render), wethApy was 0, so the navbar only showed WCHAN APY.
 * Moving all computation server-side eliminates that race condition.
 *
 * DATA SOURCES (fetched in parallel via Promise.allSettled):
 *   1. Vault indexer /apy?window=7d  — wchanAPY, wethDistributed, totalStaked, secondsElapsed
 *   2. Vault indexer /stats          — totalStaked, currentSharePrice
 *   3. CoinGecko                     — ETH price in USD (for WETH APY conversion)
 *   4. GeckoTerminal (shared cache)  — WCHAN price + market cap (for TVL + WETH APY conversion)
 *
 * WCHAN price comes from a shared in-memory cache (lib/geckoTerminalCache.ts)
 * also used by /api/token-data. This prevents duplicate GeckoTerminal requests
 * on page load which caused rate-limiting and stale 0-price responses.
 *
 * DEGRADATION:
 *   - Indexer (sources 1+2) failing → 502 (or stale cache if available)
 *   - Price APIs (sources 3+4) failing → falls back to last known good prices so
 *     wethApy/tvlUsd don't drop to 0 on intermittent failures. Only returns 0
 *     on the very first request if the price API is down (no prior cache exists).
 *
 * CACHING: In-memory 30s TTL for the full response. ETH/WCHAN prices are also
 * stored separately so a bad fetch never overwrites known-good prices.
 *
 * WETH APY FORMULA:
 *   wethApy = (wethDistributed_USD / totalStaked_USD) * (secondsPerYear / secondsElapsed) * 100
 *   where USD values are derived from ETH and WCHAN prices respectively.
 */
import { NextResponse } from "next/server";
import { WCHAN_VAULT_INDEXER_API_URL } from "../../constants";
import { getWchanPoolData } from "../../lib/geckoTerminalCache";

const COINGECKO_ETH_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

const CACHE_TTL = 30_000; // 30 seconds

interface CachedVaultData {
  totalApy: number;
  wchanApy: number;
  wethApy: number;
  totalStaked: string;
  tvlUsd: number;
  sharePrice: string;
  wchanPriceUsd: number;
  wchanMarketCapUsd: number;
  ethPriceUsd: number;
  updatedAt: number;
}

let cached: CachedVaultData | null = null;
let lastFetchedAt = 0;
// Separate store for last known good prices — survives bad fetches being
// written to `cached` (which must update every cycle for APY/staked data).
let lastGoodWchanPrice = 0;
let lastGoodWchanMarketCap = 0;
let lastGoodEthPrice = 0;

function computeWethApy(
  wethDistributed: string,
  totalStaked: string,
  secondsElapsed: number,
  ethPrice: number,
  wchanPrice: number
): number {
  if (!ethPrice || !wchanPrice || secondsElapsed <= 0) return 0;
  const wethUsd =
    parseFloat(
      (Number(BigInt(wethDistributed || "0")) / 1e18).toString()
    ) * ethPrice;
  const stakedUsd =
    parseFloat((Number(BigInt(totalStaked || "0")) / 1e18).toString()) *
    wchanPrice;
  if (stakedUsd === 0) return 0;
  return (wethUsd / stakedUsd) * (31_536_000 / secondsElapsed) * 100;
}

export async function GET() {
  const now = Date.now();
  if (cached && now - lastFetchedAt < CACHE_TTL) {
    return NextResponse.json(cached);
  }

  if (!WCHAN_VAULT_INDEXER_API_URL) {
    return NextResponse.json(
      { error: "Vault indexer URL not configured" },
      { status: 503 }
    );
  }

  const [apyResult, statsResult, ethPriceResult, wchanResult] =
    await Promise.allSettled([
      fetch(`${WCHAN_VAULT_INDEXER_API_URL}/apy?window=7d`, {
        cache: "no-store",
      }).then((r) => {
        if (!r.ok) throw new Error(`Indexer APY ${r.status}`);
        return r.json();
      }),
      fetch(`${WCHAN_VAULT_INDEXER_API_URL}/stats`, {
        cache: "no-store",
      }).then((r) => {
        if (!r.ok) throw new Error(`Indexer stats ${r.status}`);
        return r.json();
      }),
      fetch(COINGECKO_ETH_URL, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
        return r.json();
      }),
      getWchanPoolData(),
    ]);

  // Indexer data is required
  if (
    apyResult.status === "rejected" ||
    statsResult.status === "rejected"
  ) {
    // Return stale cache if available
    if (cached) {
      return NextResponse.json(cached);
    }
    return NextResponse.json(
      { error: "Failed to fetch vault indexer data" },
      { status: 502 }
    );
  }

  const apyData = apyResult.value;
  const statsData = statsResult.value;

  // Prices are optional — when APIs fail, fall back to last known good prices.
  // These are stored separately from `cached` so a bad fetch (price=0) written
  // to the cache doesn't poison future fallbacks.
  let ethPrice =
    ethPriceResult.status === "fulfilled"
      ? ethPriceResult.value?.ethereum?.usd ?? 0
      : 0;
  if (ethPrice) {
    lastGoodEthPrice = ethPrice;
  } else {
    ethPrice = lastGoodEthPrice;
  }

  let wchanPrice = 0;
  let wchanMarketCap = 0;
  if (wchanResult.status === "fulfilled") {
    const attrs = wchanResult.value?.data?.attributes;
    if (attrs) {
      wchanPrice = parseFloat(attrs.base_token_price_usd || "0");
      wchanMarketCap =
        parseFloat(attrs.market_cap_usd || "0") > 0
          ? parseFloat(attrs.market_cap_usd)
          : parseFloat(attrs.fdv_usd || "0");
    }
  }
  if (wchanPrice) {
    lastGoodWchanPrice = wchanPrice;
    lastGoodWchanMarketCap = wchanMarketCap;
  } else {
    wchanPrice = lastGoodWchanPrice;
    wchanMarketCap = lastGoodWchanMarketCap;
  }

  const wchanApy: number = apyData.wchanAPY ?? 0;
  const wethApy = computeWethApy(
    apyData.wethDistributed,
    apyData.totalStaked,
    apyData.secondsElapsed,
    ethPrice,
    wchanPrice
  );
  const totalApy = wchanApy + wethApy;

  const totalStaked = statsData.totalStaked ?? apyData.totalStaked ?? "0";
  const stakedNum = Number(BigInt(totalStaked)) / 1e18;
  const tvlUsd = stakedNum * wchanPrice;

  const result: CachedVaultData = {
    totalApy,
    wchanApy,
    wethApy,
    totalStaked,
    tvlUsd,
    sharePrice: statsData.currentSharePrice ?? apyData.sharePrice ?? "0",
    wchanPriceUsd: wchanPrice,
    wchanMarketCapUsd: wchanMarketCap,
    ethPriceUsd: ethPrice,
    updatedAt: Math.floor(now / 1000),
  };

  cached = result;
  lastFetchedAt = now;

  return NextResponse.json(result);
}
