export const ClankerFeeLockerAbi = [
  {
    type: "event",
    name: "ClaimTokens",
    inputs: [
      { name: "feeOwner", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amountClaimed", type: "uint256", indexed: false },
    ],
  },
] as const;
