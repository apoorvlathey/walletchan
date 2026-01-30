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
 * Chain IDs that are allowed for transaction signing
 */
export const ALLOWED_CHAIN_IDS = new Set([1, 137, 8453, 130]);

/**
 * Human-readable chain names by chain ID
 */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  8453: "Base",
  130: "Unichain",
};
