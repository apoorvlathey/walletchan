import type { PoolSlot0 } from "./poolState.js";

export type ArbDirection = "buy-direct-sell-bnkrw" | "buy-bnkrw-sell-direct";

export interface ArbOpportunity {
  direction: ArbDirection;
  priceDiffBps: number; // basis points of price divergence
}

/**
 * Compare sqrtPriceX96 between the direct (WETH↔WCHAN) and BNKRW (WETH↔BNKRW) pools.
 *
 * Both pools have WETH as currency0 (WETH=0x42... < WCHAN=0xBa... and WETH=0x42... < BNKRW=0xf4...).
 * sqrtPriceX96 = sqrt(token1/token0) = sqrt(WCHAN_or_BNKRW / WETH).
 *
 * Higher sqrtPriceX96 → token1 (WCHAN/BNKRW) is more expensive relative to WETH.
 * Since BNKRW↔WCHAN is 1:1, we can directly compare the two sqrtPriceX96 values.
 *
 * If directSqrtPrice > bnkrwSqrtPrice:
 *   WCHAN costs more on direct pool → buy cheap via BNKRW, sell expensive on direct
 *   Direction: buy-bnkrw-sell-direct
 *
 * If directSqrtPrice < bnkrwSqrtPrice:
 *   WCHAN costs less on direct pool → buy cheap on direct, sell expensive via BNKRW
 *   Direction: buy-direct-sell-bnkrw
 */
export function detectArbDirection(
  direct: PoolSlot0,
  bnkrw: PoolSlot0
): ArbOpportunity | null {
  const d = direct.sqrtPriceX96;
  const b = bnkrw.sqrtPriceX96;

  if (d === 0n || b === 0n) return null;

  // Calculate price diff in bps: |d - b| / min(d, b) * 10000
  const diff = d > b ? d - b : b - d;
  const base = d < b ? d : b;
  const priceDiffBps = Number((diff * 10000n) / base);

  // Need at least 1 bps divergence to consider
  if (priceDiffBps < 1) return null;

  const direction: ArbDirection =
    d > b ? "buy-bnkrw-sell-direct" : "buy-direct-sell-bnkrw";

  return { direction, priceDiffBps };
}
