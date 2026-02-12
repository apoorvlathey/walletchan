import { createConfig } from "ponder";
import { UniswapV4ScheduledMulticurveInitializerAbi } from "./abis/UniswapV4ScheduledMulticurveInitializerAbi";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
  },
  contracts: {
    UniswapV4ScheduledMulticurveInitializer: {
      chain: "base",
      abi: UniswapV4ScheduledMulticurveInitializerAbi,
      address: "0xA36715dA46Ddf4A769f3290f49AF58bF8132ED8E",
      startBlock: 42029709, // FIXME to 36659443, set it to this for faster local testing
      endBlock: 42029753,
      filter: {
        event: "Lock",
        args: {},
      },
    },
    DecayMulticurveInitializer: {
      chain: "base",
      abi: UniswapV4ScheduledMulticurveInitializerAbi,
      address: "0xD59cE43E53D69F190E15d9822Fb4540dCcc91178",
      startBlock: 42019831,
      filter: {
        event: "Lock",
        args: {},
      },
    },
  },
});
