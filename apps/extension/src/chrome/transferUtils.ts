/**
 * Utilities for building token transfer calldata
 */
import { encodeFunctionData, parseUnits, parseEther } from "viem";

const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface TransferParams {
  to: string;
  amount: string;
  contractAddress: string; // "native" for native token
  decimals: number;
  chainId: number;
}

export function buildTransferTx(params: TransferParams): {
  to: string;
  data: string;
  value: string;
} {
  const { to, amount, contractAddress, decimals } = params;

  if (contractAddress === "native") {
    // Native token transfer (ETH, MATIC, etc.)
    return {
      to,
      data: "0x",
      value: `0x${parseEther(amount).toString(16)}`,
    };
  }

  // ERC20 transfer
  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [to as `0x${string}`, parseUnits(amount, decimals)],
  });

  return {
    to: contractAddress,
    data,
    value: "0x0",
  };
}
