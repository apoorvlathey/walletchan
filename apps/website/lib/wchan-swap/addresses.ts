// AUTO-GENERATED — do not edit manually.
// Run `pnpm sync:addresses` to regenerate from apps/contracts/addresses.json

import type { Address } from "viem";

interface ChainAddresses {
  wchan: Address;
  hook: Address;
  weth: Address;
  universalRouter: Address;
  quoter: Address;
  permit2: Address;
  poolManager: Address;
}

export const ADDRESSES: Record<number, ChainAddresses> = {
  // ETH Sepolia
  11155111: {
    wchan: "0xba5ed95D945Dc4dB350aE9949B084670ef3D8eaC",
    hook: "0x740c9e5d52e15220a97ADae916465Ca8b49B20CC",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    universalRouter: "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b",
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
  // Base mainnet
  8453: {
    wchan: "0x0000000000000000000000000000000000000000",
    hook: "0x0000000000000000000000000000000000000000",
    weth: "0x4200000000000000000000000000000000000006",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
};

export type SupportedChainId = keyof typeof ADDRESSES;

export function getAddresses(chainId: number): ChainAddresses {
  const addrs = ADDRESSES[chainId];
  if (!addrs) throw new Error(`Unsupported chain: ${chainId}`);
  return addrs;
}

export function isChainLive(chainId: number): boolean {
  return chainId === 8453 || chainId === 11155111;
}
