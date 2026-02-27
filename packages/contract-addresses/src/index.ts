export {
  // Swap
  SWAP_ADDRESSES,
  getSwapAddresses,
  isChainLive,
  // Drip
  DRIP_ADDRESSES,
  SUPPORTED_DRIP_CHAIN_IDS,
  DEFAULT_DRIP_CHAIN_ID,
} from "./addresses";

export type {
  SwapChainAddresses,
  SupportedSwapChainId,
  DripChainAddresses,
} from "./addresses";

// Backwards-compatible aliases for wchan-swap consumers
export { SWAP_ADDRESSES as ADDRESSES, getSwapAddresses as getAddresses } from "./addresses";
export type { SupportedSwapChainId as SupportedChainId } from "./addresses";
