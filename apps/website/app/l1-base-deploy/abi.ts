export const optimismMintableERC20FactoryAbi = [
  {
    inputs: [
      { name: "_remoteToken", type: "address" },
      { name: "_name", type: "string" },
      { name: "_symbol", type: "string" },
    ],
    name: "createOptimismMintableERC20",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "localToken", type: "address" },
      { indexed: true, name: "remoteToken", type: "address" },
      { indexed: false, name: "deployer", type: "address" },
    ],
    name: "OptimismMintableERC20Created",
    type: "event",
  },
] as const;

export const erc20MetadataAbi = [
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
