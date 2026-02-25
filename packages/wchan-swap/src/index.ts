export { getAddresses, isChainLive, ADDRESSES } from "./addresses";
export type { SupportedChainId } from "./addresses";

export type { SwapDirection, SwapRoute, RoutePreference, PoolKey, WchanQuote, SwapConfig } from "./types";

export {
  buildPoolKey,
  buildOldTokenPoolKey,
  buildWrapPoolKey,
  isWethCurrency0,
  isWethCurrency0ForOldToken,
} from "./poolKey";

export { quoterAbi, universalRouterAbi, permit2Abi } from "./abis";

export { SLIPPAGE_PRESETS, DEFAULT_SLIPPAGE_BPS, applySlippage } from "./slippage";

export { getQuote, getQuoteViaBnkrw, getBestQuote } from "./quotes";

export {
  getPermit2Allowance,
  getErc20AllowanceToPermit2,
  buildPermitSingle,
  getPermitTypedData,
} from "./permit2";
export type { PermitSingleData } from "./permit2";

export {
  // Public encoding functions
  encodeBuyWchan,
  encodeSellWchan,
  encodeBuyWchanViaBnkrw,
  encodeSellWchanViaBnkrw,
  // Low-level encoding helpers (for arb-bot)
  encodeSwapExactInSingle,
  encodeSwapExactIn,
  encodeSettle,
  encodeSettleAll,
  encodeTake,
  encodeTakeAll,
  encodeV4Swap,
  encodeWrapEth,
  encodeUnwrapWeth,
  encodeSweep,
  encodePermit2PermitCommand,
  encodeExecute,
  // Special addresses
  ADDRESS_THIS,
  MSG_SENDER,
  ETH_ADDRESS,
} from "./router";
