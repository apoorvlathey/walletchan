import { createConfig } from "ponder";
import { DRIP_ADDRESSES } from "@walletchan/contract-addresses";
import { WCHANVaultAbi } from "./abis/WCHANVaultAbi";

const CHAIN_ID = 8453;
const START_BLOCK = 42708895;

export default createConfig({
  chains: {
    chain: {
      id: CHAIN_ID,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
  },
  contracts: {
    WCHANVault: {
      chain: "chain",
      abi: WCHANVaultAbi,
      address: DRIP_ADDRESSES[CHAIN_ID]!.wchanVault as `0x${string}`,
      startBlock: START_BLOCK,
    },
  },
});
