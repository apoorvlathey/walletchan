// Chain brand colors and icons configuration
export interface ChainConfig {
  name: string;
  bg: string;
  border: string;
  text: string;
  icon: string;
  explorer: string;
}

export const CHAIN_CONFIG: Record<number, ChainConfig> = {
  1: {
    name: "Ethereum",
    bg: "rgba(98, 126, 234, 0.15)",
    border: "rgba(98, 126, 234, 0.4)",
    text: "#627EEA",
    icon: "/chainIcons/ethereum.svg",
    explorer: "https://etherscan.io",
  },
  137: {
    name: "Polygon",
    bg: "rgba(130, 71, 229, 0.15)",
    border: "rgba(130, 71, 229, 0.4)",
    text: "#8247E5",
    icon: "/chainIcons/polygon.svg",
    explorer: "https://polygonscan.com",
  },
  4326: {
    name: "MegaETH",
    bg: "rgba(25, 25, 26, 0.15)",
    border: "rgba(25, 25, 26, 0.4)",
    text: "#19191A",
    icon: "/chainIcons/megaeth.svg",
    explorer: "https://mega.etherscan.io",
  },
  8453: {
    name: "Base",
    bg: "rgba(0, 82, 255, 0.15)",
    border: "rgba(0, 82, 255, 0.4)",
    text: "#0052FF",
    icon: "/chainIcons/base.svg",
    explorer: "https://basescan.org",
  },
  130: {
    name: "Unichain",
    bg: "rgba(255, 0, 122, 0.15)",
    border: "rgba(255, 0, 122, 0.4)",
    text: "#FF007A",
    icon: "/chainIcons/unichain.svg",
    explorer: "https://uniscan.xyz",
  },
};

// Default config for unknown chains
export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  name: "Unknown",
  bg: "rgba(255, 255, 255, 0.1)",
  border: "rgba(255, 255, 255, 0.2)",
  text: "#FAFAFA",
  icon: "",
  explorer: "",
};

// Helper to get chain config by chainId
export function getChainConfig(chainId: number): ChainConfig {
  return CHAIN_CONFIG[chainId] || DEFAULT_CHAIN_CONFIG;
}
