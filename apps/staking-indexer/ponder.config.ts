import { createConfig } from "ponder";
import { SBNKRW_VAULT_ADDRESS } from "@walletchan/shared/contracts";
import { ERC4626VaultAbi } from "./abis/ERC4626VaultAbi";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
  },
  contracts: {
    sBNKRWVault: {
      chain: "base",
      abi: ERC4626VaultAbi,
      address: SBNKRW_VAULT_ADDRESS as `0x${string}`,
      startBlock: 41983697,
    },
  },
});
