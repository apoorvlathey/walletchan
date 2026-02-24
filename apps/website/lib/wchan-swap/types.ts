import type { Address } from "viem";

export type SwapDirection = "buy" | "sell";

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface WchanQuote {
  amountIn: bigint;
  amountOut: bigint;
  direction: SwapDirection;
}

export interface SwapConfig {
  chainId: number;
  slippageBps: number;
  deadline: number; // seconds from now
}
