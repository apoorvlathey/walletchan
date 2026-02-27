export const dripRewardsAbi = [
  {
    inputs: [],
    name: "drip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "canDrip",
    outputs: [
      { name: "wchanCan", type: "bool" },
      { name: "wethCan", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "wchanStream",
    outputs: [
      { name: "startTimestamp", type: "uint256" },
      { name: "endTimestamp", type: "uint256" },
      { name: "lastDripTimestamp", type: "uint256" },
      { name: "amountRemaining", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "wethStream",
    outputs: [
      { name: "startTimestamp", type: "uint256" },
      { name: "endTimestamp", type: "uint256" },
      { name: "lastDripTimestamp", type: "uint256" },
      { name: "amountRemaining", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "previewDrip",
    outputs: [
      { name: "wchanAmount", type: "uint256" },
      { name: "wethAmount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minDripInterval",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
