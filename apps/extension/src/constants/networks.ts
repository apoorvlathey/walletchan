import { NetworksInfo } from "@/types";

/**
 * Default networks with public RPCs for BankrWallet
 * These are the only chains supported for transaction signing
 */
export const DEFAULT_NETWORKS: NetworksInfo = {
  Base: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
  },
  Ethereum: {
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
  },
  MegaETH: {
    chainId: 4326,
    rpcUrl: "https://mainnet.megaeth.com/rpc",
  },
  Polygon: {
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
  },
  Unichain: {
    chainId: 130,
    rpcUrl: "https://mainnet.unichain.org",
  },
};

/**
 * Chain IDs that are allowed for transaction signing (all account types)
 */
export const ALLOWED_CHAIN_IDS = new Set([1, 137, 4326, 8453, 130]);

/**
 * Chain IDs supported by Bankr API accounts.
 * New chains that aren't supported by the Bankr API should NOT be added here.
 */
export const BANKR_SUPPORTED_CHAIN_IDS = new Set([1, 137, 8453, 130]);

/**
 * OP Stack L2 chain IDs (for L1 fee breakdown in gas display)
 */
export const OP_STACK_CHAIN_IDS = new Set([4326, 8453, 130]);

/**
 * Human-readable chain names by chain ID
 */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  4326: "MegaETH",
  8453: "Base",
  130: "Unichain",
};
