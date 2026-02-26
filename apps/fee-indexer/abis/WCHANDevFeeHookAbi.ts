export const WCHANDevFeeHookAbi = [
  {
    type: "event",
    name: "WethClaimed",
    inputs: [
      { name: "dev", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
