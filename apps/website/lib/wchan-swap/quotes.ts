import { encodeFunctionData, decodeAbiParameters } from "viem";
import { quoterAbi } from "./abis";
import { getAddresses } from "./addresses";
import { buildPoolKey, isWethCurrency0 } from "./poolKey";
import type { SwapDirection, WchanQuote } from "./types";
import { CHAIN_RPC_URLS } from "../../app/wagmiConfig";

const RETURN_TYPES = [
  { type: "uint256" as const, name: "amountOut" as const },
  { type: "uint256" as const, name: "gasEstimate" as const },
] as const;

export async function getQuote(
  _client: unknown, // kept for API compat, unused
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  const { quoter } = getAddresses(chainId);
  const poolKey = buildPoolKey(chainId);

  const wethIs0 = isWethCurrency0(chainId);
  const zeroForOne = direction === "buy" ? wethIs0 : !wethIs0;

  const calldata = encodeFunctionData({
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        },
        zeroForOne,
        exactAmount: amountIn,
        hookData: "0x",
      },
    ],
  });

  // Raw eth_call via fetch — bypasses viem client pipeline entirely
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) throw new Error(`No RPC URL for chain ${chainId}`);

  const rpcResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: quoter, data: calldata }, "latest"],
    }),
  });

  const json = await rpcResponse.json();
  if (json.error) {
    throw new Error(json.error.message || "Quoter RPC error");
  }

  const data = json.result as `0x${string}`;
  if (!data || data === "0x") throw new Error("Empty quoter response");

  const [amountOut] = decodeAbiParameters(RETURN_TYPES, data);

  return { amountIn, amountOut, direction };
}
