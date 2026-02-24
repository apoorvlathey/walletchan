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
  oldToken: Address;
  wrapHook: Address;
  oldTokenPoolHook: Address;
}

export const ADDRESSES: Record<number, ChainAddresses> = {
  // ETH Sepolia
  11155111: {
    wchan: "0xba5ed95D945Dc4dB350aE9949B084670ef3D8eaC",
    hook: "0x740c9e5d52e15220a97ADae916465Ca8b49B20CC",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    universalRouter: "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b",
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    oldToken: "0x89133805fD93aB6be23ECD0CC14938e59cf22278",
    wrapHook: "0x46cf392C84c6d6270b3e4FD0c4145b790fe0a888",
    quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    oldTokenPoolHook: "0x0000000000000000000000000000000000000000",
  },
  // Base mainnet
  8453: {
    wchan: "0xBa5ED004A2F3218478b54d094f269d6cE166D6d7",
    hook: "0xCC3CA5D1699e28C198640F8B4820819C0428a0Cc",
    weth: "0x4200000000000000000000000000000000000006",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    oldToken: "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07",
    wrapHook: "0xe4E1b42FD6AE5C163a1613eA40735677f3986888",
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    oldTokenPoolHook: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC",
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
