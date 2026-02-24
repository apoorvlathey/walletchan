import type { Address } from "viem";
import type { PoolKey } from "./types";
import { getAddresses } from "./addresses";

const POOL_FEE = 0;
const TICK_SPACING = 60;

// OLD_TOKEN pool (WETH↔BNKRW) uses dynamic fee flag
const OLD_TOKEN_POOL_FEE = 0x800000; // DYNAMIC_FEE_FLAG
const OLD_TOKEN_TICK_SPACING = 200;

export function isWethCurrency0(chainId: number): boolean {
  const { wchan, weth } = getAddresses(chainId);
  return weth.toLowerCase() < wchan.toLowerCase();
}

export function isWethCurrency0ForOldToken(chainId: number): boolean {
  const { oldToken, weth } = getAddresses(chainId);
  return weth.toLowerCase() < oldToken.toLowerCase();
}

/** WETH↔WCHAN pool (direct route via DEV_FEE_HOOK) */
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

/** WETH↔BNKRW pool (OLD_TOKEN pool with dynamic fee) */
export function buildOldTokenPoolKey(chainId: number): PoolKey {
  const { oldToken, weth, oldTokenPoolHook } = getAddresses(chainId);

  const [currency0, currency1] = isWethCurrency0ForOldToken(chainId)
    ? [weth, oldToken]
    : [oldToken, weth];

  return {
    currency0: currency0 as Address,
    currency1: currency1 as Address,
    fee: OLD_TOKEN_POOL_FEE,
    tickSpacing: OLD_TOKEN_TICK_SPACING,
    hooks: oldTokenPoolHook as Address,
  };
}

/** BNKRW↔WCHAN pool (1:1 wrap via WCHAN_WRAP_HOOK) */
export function buildWrapPoolKey(chainId: number): PoolKey {
  const { oldToken, wchan, wrapHook } = getAddresses(chainId);

  const [currency0, currency1] =
    oldToken.toLowerCase() < wchan.toLowerCase()
      ? [oldToken, wchan]
      : [wchan, oldToken];

  return {
    currency0: currency0 as Address,
    currency1: currency1 as Address,
    fee: POOL_FEE,
    tickSpacing: TICK_SPACING,
    hooks: wrapHook as Address,
  };
}
