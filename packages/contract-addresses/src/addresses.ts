// AUTO-GENERATED — do not edit manually.
// Run `pnpm sync:addresses` to regenerate from apps/contracts/addresses.json

import type { Address } from "viem";

// ─── Swap Addresses ───

export interface SwapChainAddresses {
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

export const SWAP_ADDRESSES: Record<number, SwapChainAddresses> = {
  // ETH Sepolia
  11155111: {
    wchan: "0xBA5ED02404bF5Dc7a0799b8D6CD35FA003D3bc5b",
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
    wchan: "0xBa5ED0000e1CA9136a695f0a848012A16008B032",
    hook: "0xD36646b7Aa77707c47478f64C1770e4c2F3f20cc",
    weth: "0x4200000000000000000000000000000000000006",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
    oldToken: "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07",
    wrapHook: "0x8243a251EC38fB31c6410B3A28b0F370b4022888",
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    oldTokenPoolHook: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC",
  },
};

export type SupportedSwapChainId = keyof typeof SWAP_ADDRESSES;

export function getSwapAddresses(chainId: number): SwapChainAddresses {
  const addrs = SWAP_ADDRESSES[chainId];
  if (!addrs) throw new Error(`Unsupported swap chain: ${chainId}`);
  return addrs;
}

export function isChainLive(chainId: number): boolean {
  return chainId === 8453 || chainId === 11155111;
}

// ─── Drip Addresses ───

export interface DripChainAddresses {
  wchan: Address;
  weth: Address;
  wchanVault: Address;
  dripWchanRewards: Address;
}

export const DRIP_ADDRESSES: Record<number, DripChainAddresses> = {
  // ETH Sepolia
  11155111: {
    wchan: "0xBA5ED02404bF5Dc7a0799b8D6CD35FA003D3bc5b",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    wchanVault: "0x3a17066AC8e75192FC64B916636A4672dB93e3aF",
    dripWchanRewards: "0xF03e1a1057AbaE885770D431D4670F79FDB29B3f",
  },
  // Base mainnet
  8453: {
    wchan: "0xBa5ED0000e1CA9136a695f0a848012A16008B032",
    weth: "0x4200000000000000000000000000000000000006",
    wchanVault: "0x3F5ac2c27BBf08522Bc1F5C92237E137356A8AC8",
    dripWchanRewards: "0x965A4426104eF88D54F8F9D06258911B2F4F28E9",
  },
};

export const SUPPORTED_DRIP_CHAIN_IDS = Object.keys(DRIP_ADDRESSES).map(Number);

// ─── Migrate Staking Zap Addresses ───

export interface MigrateStakingZapChainAddresses {
  migrateZap: Address;
  oldVault: Address;
  wchanVault: Address;
  wchan: Address;
  oldToken: Address;
}

export const MIGRATE_STAKING_ZAP_ADDRESSES: Record<number, MigrateStakingZapChainAddresses> = {
  // Base mainnet
  8453: {
    migrateZap: "0x6b623E7EaE9F2717aBB042bF29EEFeabeA8237Fe",
    oldVault: "0x7ac242481d5122c4d3400492aF6ADfBce21D7113",
    wchanVault: "0x3F5ac2c27BBf08522Bc1F5C92237E137356A8AC8",
    wchan: "0xBa5ED0000e1CA9136a695f0a848012A16008B032",
    oldToken: "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07",
  },
};

export function getMigrateStakingZapAddresses(chainId: number): MigrateStakingZapChainAddresses {
  const addrs = MIGRATE_STAKING_ZAP_ADDRESSES[chainId];
  if (!addrs) throw new Error(`Unsupported migrate staking zap chain: ${chainId}`);
  return addrs;
}
