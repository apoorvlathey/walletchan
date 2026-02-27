export const WCHANVaultAbi = [
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
