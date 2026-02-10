export const UniswapV4ScheduledMulticurveInitializerAbi = [
  {
    type: "event",
    name: "Lock",
    inputs: [
      {
        name: "pool",
        type: "address",
        indexed: true,
      },
      {
        name: "beneficiaries",
        type: "tuple[]",
        indexed: false,
        components: [
          {
            name: "account",
            type: "address",
          },
          {
            name: "bips",
            type: "uint96",
          },
        ],
      },
    ],
  },
] as const;
