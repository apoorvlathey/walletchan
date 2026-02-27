export const WCHANVaultAbi = [
  // ERC4626 standard events
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "assets", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "shares", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "receiver", type: "address", indexed: true, internalType: "address" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "assets", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "shares", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  // View functions (for reading on-chain state in handlers)
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  // Custom events
  {
    type: "event",
    name: "Donate",
    inputs: [
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalAssets", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalShares", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DonateReward",
    inputs: [
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalAssets", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalShares", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EarlyWithdrawPenalty",
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "penaltyAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "burnedAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "retainedAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalAssets", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "totalShares", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
