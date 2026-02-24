export const SLIPPAGE_PRESETS = [50, 100, 300]; // 0.5%, 1%, 3%
export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * (10000n - BigInt(slippageBps))) / 10000n;
}
