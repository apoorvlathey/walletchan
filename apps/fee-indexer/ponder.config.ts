import { createConfig } from "ponder";
import { ClankerFeeLockerAbi } from "./abis/ClankerFeeLockerAbi";
import { WCHANDevFeeHookAbi } from "./abis/WCHANDevFeeHookAbi";
import { PoolManagerAbi } from "./abis/PoolManagerAbi";

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
      filter: {
        event: "ClaimTokens",
        args: {
          feeOwner: "0x74992be74bc3c3A72E97dF34A2C3A62c15f55970",
          token: [
            "0x4200000000000000000000000000000000000006",
            "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07",
          ],
        },
      },
    },
    WCHANDevFeeHook: {
      chain: "base",
      abi: WCHANDevFeeHookAbi,
      address: "0xD36646b7Aa77707c47478f64C1770e4c2F3f20cc",
      startBlock: 42607730,
    },
    PoolManager: {
      chain: "base",
      abi: PoolManagerAbi,
      address: "0x498581ff718922c3f8e6a244956af099b2652b2b",
      startBlock: 42792816,
      filter: {
        event: "ModifyLiquidity",
        args: {
          id: "0x81C7A2A2C33EA285F062C5AC0C4E3D4FFB2F6FD2588BBD354D0D3AF8A58B6337",
        },
      },
    },
  },
});
