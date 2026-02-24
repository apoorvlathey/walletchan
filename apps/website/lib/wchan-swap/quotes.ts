import { encodeFunctionData, decodeAbiParameters } from "viem";
import { quoterAbi } from "./abis";
import { getAddresses } from "./addresses";
import {
  buildPoolKey,
  buildOldTokenPoolKey,
  isWethCurrency0,
  isWethCurrency0ForOldToken,
} from "./poolKey";
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

  return { amountIn, amountOut, direction, route: "direct" as const };
}

/**
 * Quote via BNKRW route: WETH↔BNKRW (OLD_TOKEN pool) + BNKRW↔WCHAN (1:1 wrap).
 * Since the wrap hop is 1:1, we only need to quote the WETH↔BNKRW hop.
 */
export async function getQuoteViaBnkrw(
  _client: unknown,
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  const { quoter } = getAddresses(chainId);
  const poolKey = buildOldTokenPoolKey(chainId);

  const wethIs0 = isWethCurrency0ForOldToken(chainId);
  // Buy WCHAN = buy BNKRW with WETH → wrap to WCHAN
  // Sell WCHAN = unwrap WCHAN to BNKRW → sell BNKRW for WETH
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
    throw new Error(json.error.message || "Quoter RPC error (via-bnkrw)");
  }

  const data = json.result as `0x${string}`;
  if (!data || data === "0x") throw new Error("Empty quoter response (via-bnkrw)");

  const [amountOut] = decodeAbiParameters(RETURN_TYPES, data);

  // amountOut from WETH↔BNKRW hop = final WCHAN amount (1:1 wrap)
  return { amountIn, amountOut, direction, route: "via-bnkrw" as const };
}

/**
 * Fetch both routes in parallel and return the one with higher amountOut.
 * Falls back to the other route if one fails.
 */
export async function getBestQuote(
  client: unknown,
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  const [directResult, viaBnkrwResult] = await Promise.allSettled([
    getQuote(client, chainId, direction, amountIn),
    getQuoteViaBnkrw(client, chainId, direction, amountIn),
  ]);

  const directQuote =
    directResult.status === "fulfilled" ? directResult.value : null;
  const viaBnkrwQuote =
    viaBnkrwResult.status === "fulfilled" ? viaBnkrwResult.value : null;

  if (directQuote) {
    console.log(
      `[swap-wchan] Direct route: ${amountIn} → ${directQuote.amountOut}`
    );
  } else {
    console.log(
      `[swap-wchan] Direct route failed:`,
      directResult.status === "rejected" ? directResult.reason : "unknown"
    );
  }
  if (viaBnkrwQuote) {
    console.log(
      `[swap-wchan] Via-BNKRW route: ${amountIn} → ${viaBnkrwQuote.amountOut}`
    );
  } else {
    console.log(
      `[swap-wchan] Via-BNKRW route failed:`,
      viaBnkrwResult.status === "rejected" ? viaBnkrwResult.reason : "unknown"
    );
  }

  if (directQuote && viaBnkrwQuote) {
    const best =
      viaBnkrwQuote.amountOut > directQuote.amountOut
        ? viaBnkrwQuote
        : directQuote;
    console.log(`[swap-wchan] Best route: ${best.route}`);
    return best;
  }

  if (directQuote) return directQuote;
  if (viaBnkrwQuote) return viaBnkrwQuote;

  // Both failed — rethrow the direct route error
  throw directResult.status === "rejected"
    ? directResult.reason
    : new Error("Both routes failed");
}
