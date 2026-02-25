import type { Hex } from "viem";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  privateKey: requireEnv("PRIVATE_KEY") as Hex,
  rpcUrl: requireEnv("BASE_RPC_URL"),
  chainId: 8453,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 2000),
  minProfitWei: BigInt(process.env.MIN_PROFIT_WEI || "1000000000000"), // 0.000001 ETH
  slippageBps: Number(process.env.SLIPPAGE_BPS || 30), // 0.3%
  // Minimum sqrtPrice divergence (bps) to attempt arb.
  // Round-trip fee = 1 - (1 - directPoolFee)(1 - bnkrwPoolFee)
  // With 1% + 1.2% fees: 1 - 0.99 * 0.988 = 2.19% price = ~110 bps sqrtPrice.
  // Default 120 bps adds buffer for gas.
  minArbBps: Number(process.env.MIN_ARB_BPS || 120),
} as const;
