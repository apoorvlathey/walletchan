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
} as const;
