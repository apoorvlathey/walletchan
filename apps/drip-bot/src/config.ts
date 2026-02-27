import type { Hex, Address } from "viem";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  privateKey: requireEnv("PRIVATE_KEY") as Hex,
  rpcUrl: requireEnv("BASE_RPC_URL"),
  chainId: 8453,
  maxSleepMs: Number(process.env.MAX_SLEEP_MS || 1_800_000), // 30 min
  dripContract: "0x965A4426104eF88D54F8F9D06258911B2F4F28E9" as Address,
} as const;
