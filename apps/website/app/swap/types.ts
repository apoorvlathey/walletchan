export type SwapProvider = "0x" | "bungee" | "relay";

export interface SwapQuote {
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  gas: string;
  gasPrice: string;
  totalNetworkFee: string;
  liquidityAvailable: boolean;
  minBuyAmount: string;
  allowanceTarget: string;
  issues: {
    allowance?: {
      spender: string;
      actual: string;
      expected: string;
    };
    balance?: {
      token: string;
      actual: string;
      expected: string;
    };
  };
  fees: {
    integratorFee?: {
      amount: string;
      token: string;
      type: string;
    };
    zeroExFee?: {
      amount: string;
      token: string;
      type: string;
    };
  };
  route: {
    fills: Array<{
      from: string;
      to: string;
      source: string;
      proportionBps: string;
    }>;
  };
  // Only present on firm quote responses
  transaction?: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}
