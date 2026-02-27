export {
  // Swap
  SWAP_ADDRESSES,
  getSwapAddresses,
  isChainLive,
  // Drip
  DRIP_ADDRESSES,
  SUPPORTED_DRIP_CHAIN_IDS,
  // Migrate Staking Zap
  MIGRATE_STAKING_ZAP_ADDRESSES,
  getMigrateStakingZapAddresses,
} from "./addresses";

export type {
  SwapChainAddresses,
  SupportedSwapChainId,
  DripChainAddresses,
  MigrateStakingZapChainAddresses,
} from "./addresses";

// Backwards-compatible aliases for wchan-swap consumers
export { SWAP_ADDRESSES as ADDRESSES, getSwapAddresses as getAddresses } from "./addresses";
export type { SupportedSwapChainId as SupportedChainId } from "./addresses";
