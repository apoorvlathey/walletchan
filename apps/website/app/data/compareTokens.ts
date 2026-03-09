import { TOKEN_ADDRESS, POOL_ADDRESS } from "../constants";

export interface CompareToken {
  name: string;
  symbol: string;
  logo: string;
  network: string; // GeckoTerminal network ID: "base", "eth", "solana", etc.
  poolAddress: string;
  website?: string;
  isOurs?: boolean;
}

export interface NoTokenWallet {
  name: string;
  logo: string;
  website?: string;
}

// source: https://www.coingecko.com/en/categories/wallets
export const compareTokens: CompareToken[] = [
  {
    name: "WalletChan",
    symbol: "WCHAN",
    logo: "/images/walletchan-icon-nobg.png",
    network: "base",
    poolAddress: POOL_ADDRESS,
    website: "https://walletchan.com",
    isOurs: true,
  },
  {
    name: "Trust Wallet",
    symbol: "TWT",
    logo: "https://assets.coingecko.com/coins/images/11085/standard/Trust.png?1696511026",
    network: "bsc",
    poolAddress: "0x8ccb4544b3030dacf3d4d71c658f04e8688e25b1",
    website: "https://trustwallet.com/",
  },
  {
    name: "Safe",
    symbol: "SAFE",
    logo: "https://assets.coingecko.com/coins/images/27032/standard/Artboard_1_copy_8circle-1.png?1696526084",
    network: "eth",
    poolAddress: "0x000ba527862e5b82cff0f7c66b646af023274aa1",
    website: "https://safe.global/",
  },
  {
    name: "Infinex",
    symbol: "INX",
    logo: "https://assets.coingecko.com/coins/images/70868/standard/infinex.png?1764322875",
    network: "bsc",
    poolAddress:
      "0x551cfa36552cec4c5a4741d0c0fc387e55f702caf17d47f5ca0a794dc41aa2ec",
    website: "https://infinex.xyz/",
  },
  {
    name: "WalletConnect",
    symbol: "WCT",
    logo: "https://assets.coingecko.com/coins/images/50390/standard/wc-token1.png?1727569464",
    network: "optimism",
    poolAddress: "0x7de4c593fe83417ca6ef98d7cf59c99d304f41c9",
    website: "https://walletconnect.network/",
  },
  {
    name: "Ambire Wallet",
    symbol: "WALLET",
    logo: "https://assets.coingecko.com/coins/images/23154/standard/wallet.PNG?1696522445",
    network: "eth",
    poolAddress: "0x53bbdf4ea397d17a6f904dc882b3fb78a6875a66",
    website: "https://www.ambire.com/",
  },
  {
    name: "Rainbow",
    symbol: "RNBW",
    logo: "https://assets.coingecko.com/coins/images/69445/standard/RNBW-200px.png?1770053251",
    network: "base",
    poolAddress:
      "0xb8e3840b850cd5e2d8229e54a04c3a10b653d072870bbfb26847d237fc655a37",
    website: "https://rainbow.me/",
  },
  {
    name: "XDEFI",
    symbol: "XDEFI",
    logo: "https://assets.coingecko.com/coins/images/19524/standard/xdefi.jpg?1723436519",
    network: "eth",
    poolAddress: "0x37fc088cfd67349be00f5504d00ddb7f2274b3f6",
    website: "https://ctrl.xyz/",
  },
];

export const noTokenWallets: NoTokenWallet[] = [
  {
    name: "MetaMask",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://metamask.io&size=128",
    website: "https://metamask.io",
  },
  {
    name: "Rabby",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://rabby.io&size=128",
    website: "https://rabby.io",
  },
  {
    name: "Phantom",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://phantom.com/&size=128",
    website: "https://phantom.com",
  },
];
