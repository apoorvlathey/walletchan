import type { PublicClient } from "viem";
import {
  applyPriorityFloor,
  iqrFilter,
} from "./feePolicy";
import type { EstimatedFeeTiers } from "./types";

const FEE_HISTORY_BLOCK_COUNT = 10;
const FEE_HISTORY_REWARD_PERCENTILE = 50;

function parseTip(value: unknown): bigint | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value)
    ? BigInt(value)
    : null;
}

export async function legacyGasPriceTiers(
  client: PublicClient,
  floor: bigint,
): Promise<EstimatedFeeTiers | null> {
  let gasPrice: bigint;
  try {
    const hex = await client.request({ method: "eth_gasPrice" as any } as any);
    if (typeof hex !== "string") return null;
    gasPrice = BigInt(hex);
  } catch {
    return null;
  }
  const base = applyPriorityFloor(gasPrice, floor);
  const standard = (base * 110n) / 100n;
  const fast = (base * 125n) / 100n;
  return {
    tiers: {
      slow: { maxFeePerGas: base, maxPriorityFeePerGas: base },
      standard: {
        maxFeePerGas: standard,
        maxPriorityFeePerGas: standard,
      },
      fast: { maxFeePerGas: fast, maxPriorityFeePerGas: fast },
    },
    baseFee: 0n,
    predictedNextBaseFee: 0n,
  };
}

export async function collectPriorityFeeSamples(
  client: PublicClient,
): Promise<bigint[] | null> {
  let history: any;
  try {
    history = await client.request({
      method: "eth_feeHistory",
      params: [
        `0x${FEE_HISTORY_BLOCK_COUNT.toString(16)}`,
        "latest",
        [FEE_HISTORY_REWARD_PERCENTILE],
      ] as any,
    } as any);
  } catch {
    return null;
  }
  const rewards = history?.reward as string[][] | undefined;
  if (
    !Array.isArray(rewards) || rewards.length === 0 ||
    rewards.length > FEE_HISTORY_BLOCK_COUNT
  ) return null;
  const samples: bigint[] = [];
  for (const entry of rewards) {
    if (!Array.isArray(entry) || entry.length !== 1) return null;
    const value = parseTip(entry[0]);
    if (value === null) return null;
    if (value > 0n) samples.push(value);
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return iqrFilter(samples);
}

export async function tryMaxPriorityFeePerGas(
  client: PublicClient,
): Promise<bigint | null> {
  try {
    const hex = await client.request({
      method: "eth_maxPriorityFeePerGas" as any,
    } as any);
    return parseTip(hex);
  } catch {
    return null;
  }
}
