import type { Address } from "viem";
import type { PoolKey } from "./types";
import { getAddresses } from "./addresses";

const POOL_FEE = 0;
const TICK_SPACING = 60;

export function isWethCurrency0(chainId: number): boolean {
  const { wchan, weth } = getAddresses(chainId);
  return weth.toLowerCase() < wchan.toLowerCase();
}

export function buildPoolKey(chainId: number): PoolKey {
  const { wchan, weth, hook } = getAddresses(chainId);

  const [currency0, currency1] = isWethCurrency0(chainId)
    ? [weth, wchan]
    : [wchan, weth];

  return {
    currency0: currency0 as Address,
    currency1: currency1 as Address,
    fee: POOL_FEE,
    tickSpacing: TICK_SPACING,
    hooks: hook as Address,
  };
}
