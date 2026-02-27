// Re-exports from @walletchan/contract-addresses for backwards compatibility.
// The canonical source of truth is packages/contract-addresses.

export {
  SWAP_ADDRESSES as ADDRESSES,
  getSwapAddresses as getAddresses,
  isChainLive,
} from "@walletchan/contract-addresses";

export type {
  SwapChainAddresses as ChainAddresses,
  SupportedSwapChainId as SupportedChainId,
} from "@walletchan/contract-addresses";
