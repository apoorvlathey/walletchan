import { http, createConfig } from "wagmi";
import {
  mainnet,
  base,
  polygon,
  unichain,
  arbitrum,
  optimism,
  bsc,
  avalanche,
  zora,
  celo,
  gnosis,
  ink,
  pulsechain,
  soneium,
  sonic,
  megaeth,
} from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
      ],
    },
  ],
  { appName: "BankrWallet", projectId }
);

export const walletChains = [
  mainnet,
  base,
  polygon,
  unichain,
  arbitrum,
  optimism,
  bsc,
  avalanche,
  zora,
  celo,
  gnosis,
  ink,
  pulsechain,
  soneium,
  sonic,
  megaeth,
] as const;

/** Custom RPC URLs for the ImpersonatorIframeProvider */
export const CHAIN_RPC_URLS: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com",
  8453: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base.llamarpc.com",
  137: "https://polygon.llamarpc.com",
  130: "https://mainnet.unichain.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  56: "https://bsc-dataseed.binance.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  7777777: "https://rpc.zora.energy",
  42220: "https://forno.celo.org",
  100: "https://rpc.gnosischain.com",
  57073: "https://rpc-gel.inkonchain.com",
  369: "https://rpc.pulsechain.com",
  1868: "https://rpc.soneium.org",
  146: "https://rpc.soniclabs.com",
  4326: "https://mainnet.megaeth.com/rpc",
};

export const config = createConfig({
  connectors,
  chains: walletChains,
  transports: walletChains.reduce<Record<number, ReturnType<typeof http>>>(
    (acc, chain) => {
      acc[chain.id] = http(CHAIN_RPC_URLS[chain.id]);
      return acc;
    },
    {}
  ),
});
