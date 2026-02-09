import dappsData from "./dapps.json";

export interface DappEntry {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
  chains: number[];
}

export const DAPPS: DappEntry[] = dappsData;

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  137: "Polygon",
  130: "Unichain",
  42161: "Arbitrum",
  10: "Optimism",
  56: "BSC",
  43114: "Avalanche",
  7777777: "Zora",
  42220: "Celo",
  100: "Gnosis",
  57073: "Ink",
  369: "PulseChain",
  1868: "Soneium",
  146: "Sonic",
  4326: "MegaETH",
};
