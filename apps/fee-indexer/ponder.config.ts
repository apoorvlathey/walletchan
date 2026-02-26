import { createConfig } from "ponder";
import { ClankerFeeLockerAbi } from "./abis/ClankerFeeLockerAbi";
import { WCHANDevFeeHookAbi } from "./abis/WCHANDevFeeHookAbi";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
  },
  contracts: {
    ClankerFeeLocker: {
      chain: "base",
      abi: ClankerFeeLockerAbi,
      address: "0xF3622742b1E446D92e45E22923Ef11C2fcD55D68",
      startBlock: 41506598,
    },
    WCHANDevFeeHook: {
      chain: "base",
      abi: WCHANDevFeeHookAbi,
      address: "0xD36646b7Aa77707c47478f64C1770e4c2F3f20cc",
      startBlock: 42607730,
    },
  },
});
