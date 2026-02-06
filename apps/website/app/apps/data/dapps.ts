export interface DappEntry {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
  categories: string[];
  chains: number[];
}

/**
 * Curated dapp list for the Apps directory.
 * Source: Safe Global dapp registry + manual additions.
 */
export const DAPPS: DappEntry[] = [
  {
    id: 1,
    name: "Uniswap",
    description: "Swap tokens and provide liquidity on the leading DEX",
    url: "https://app.uniswap.org",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/1/icon.png",
    categories: ["DeFi", "DEX"],
    chains: [1, 137, 8453],
  },
  {
    id: 2,
    name: "Aave",
    description: "Lend and borrow crypto assets with variable or stable rates",
    url: "https://app.aave.com",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/2/icon.png",
    categories: ["DeFi", "Lending"],
    chains: [1, 137, 8453],
  },
  {
    id: 3,
    name: "1inch",
    description: "DEX aggregator for the best swap rates across exchanges",
    url: "https://app.1inch.io",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/14/icon.png",
    categories: ["DeFi", "Aggregator"],
    chains: [1, 137, 8453],
  },
  {
    id: 4,
    name: "Lido",
    description: "Liquid staking for ETH — stake without locking assets",
    url: "https://stake.lido.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/40/icon.png",
    categories: ["DeFi", "Staking"],
    chains: [1],
  },
  {
    id: 5,
    name: "Curve Finance",
    description: "Stablecoin DEX with low slippage and efficient swaps",
    url: "https://curve.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/7/icon.png",
    categories: ["DeFi", "DEX"],
    chains: [1, 137],
  },
  {
    id: 6,
    name: "Balancer",
    description: "Automated portfolio manager and liquidity provider",
    url: "https://app.balancer.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/11/icon.png",
    categories: ["DeFi", "DEX"],
    chains: [1, 137],
  },
  {
    id: 7,
    name: "Yearn Finance",
    description: "Automated yield strategies for DeFi",
    url: "https://yearn.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/54/icon.png",
    categories: ["DeFi", "Yield"],
    chains: [1],
  },
  {
    id: 8,
    name: "CoW Swap",
    description: "MEV-protected trading with batch auctions",
    url: "https://swap.cow.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/54/icon.png",
    categories: ["DeFi", "DEX"],
    chains: [1],
  },
  {
    id: 9,
    name: "Aerodrome",
    description: "The central trading and liquidity hub on Base",
    url: "https://aerodrome.finance",
    iconUrl: "https://www.google.com/s2/favicons?domain=aerodrome.finance&sz=64",
    categories: ["DeFi", "DEX"],
    chains: [8453],
  },
  {
    id: 10,
    name: "Morpho",
    description: "Optimized lending protocol for better rates",
    url: "https://app.morpho.org",
    iconUrl: "https://www.google.com/s2/favicons?domain=morpho.org&sz=64",
    categories: ["DeFi", "Lending"],
    chains: [1, 8453],
  },
  {
    id: 11,
    name: "Compound",
    description: "Algorithmic money market protocol for lending and borrowing",
    url: "https://app.compound.finance",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/6/icon.png",
    categories: ["DeFi", "Lending"],
    chains: [1, 137],
  },
  {
    id: 12,
    name: "ParaSwap",
    description: "DEX aggregator optimizing trades across multiple protocols",
    url: "https://app.paraswap.io",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/22/icon.png",
    categories: ["DeFi", "Aggregator"],
    chains: [1, 137],
  },
  {
    id: 13,
    name: "Zapper",
    description: "Track and manage your DeFi portfolio",
    url: "https://zapper.xyz",
    iconUrl: "https://www.google.com/s2/favicons?domain=zapper.xyz&sz=64",
    categories: ["Dashboard"],
    chains: [1, 137, 8453],
  },
  {
    id: 14,
    name: "DeBank",
    description: "Web3 social and portfolio tracker",
    url: "https://debank.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=debank.com&sz=64",
    categories: ["Dashboard"],
    chains: [1, 137, 8453],
  },
  {
    id: 15,
    name: "OpenSea",
    description: "The largest NFT marketplace",
    url: "https://opensea.io",
    iconUrl: "https://www.google.com/s2/favicons?domain=opensea.io&sz=64",
    categories: ["NFT"],
    chains: [1, 137, 8453],
  },
  {
    id: 16,
    name: "Pendle",
    description: "Trade future yield on DeFi assets",
    url: "https://app.pendle.finance",
    iconUrl: "https://www.google.com/s2/favicons?domain=pendle.finance&sz=64",
    categories: ["DeFi", "Yield"],
    chains: [1],
  },
];

export const ALL_CATEGORIES = [...new Set(DAPPS.flatMap((d) => d.categories))].sort();

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  8453: "Base",
  130: "Unichain",
};
