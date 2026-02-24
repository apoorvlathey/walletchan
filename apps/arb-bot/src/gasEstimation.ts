import { formatEther } from "viem";
import { config } from "./config.js";
import { log } from "./logger.js";

export interface GasCost {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
}

/**
 * Estimate gas cost for a transaction with buffer for priority fee.
 * Uses raw JSON-RPC batch to get gas estimate + fee data in a single HTTP request.
 */
export async function estimateGasCost(
  tx: { to: `0x${string}`; data: `0x${string}`; value: bigint },
  from: `0x${string}`
): Promise<GasCost> {
  const rpcRequests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_estimateGas",
      params: [
        {
          from,
          to: tx.to,
          data: tx.data,
          value: tx.value > 0n ? `0x${tx.value.toString(16)}` : "0x0",
        },
      ],
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_maxPriorityFeePerGas",
      params: [],
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    },
  ];

  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rpcRequests),
  });

  const results = (await response.json()) as Array<{
    id: number;
    result?: any;
    error?: { message: string; code?: number };
  }>;

  results.sort((a, b) => a.id - b.id);

  // Gas estimate (will throw if tx reverts)
  if (results[0].error || !results[0].result) {
    throw new Error(
      results[0].error?.message || "Gas estimation failed"
    );
  }
  const gasEstimate = BigInt(results[0].result);

  // Priority fee
  const priorityFeeRaw = results[1].result
    ? BigInt(results[1].result)
    : 1000000n; // fallback: 0.001 gwei

  // Base fee from latest block
  const baseFee = results[2].result?.baseFeePerGas
    ? BigInt(results[2].result.baseFeePerGas)
    : priorityFeeRaw;

  // Add 20% buffer to gas limit
  const gasLimit = (gasEstimate * 120n) / 100n;

  // 20% priority fee bump for faster inclusion
  const maxPriorityFeePerGas = (priorityFeeRaw * 120n) / 100n;

  // maxFeePerGas = 2 * baseFee + priorityFee (standard EIP-1559 formula)
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  const estimatedCostWei = gasLimit * maxFeePerGas;

  log.debug(
    `Gas: limit=${gasLimit} maxFee=${maxFeePerGas} priorityFee=${maxPriorityFeePerGas} cost=${formatEther(estimatedCostWei)} ETH`
  );

  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas, estimatedCostWei };
}
