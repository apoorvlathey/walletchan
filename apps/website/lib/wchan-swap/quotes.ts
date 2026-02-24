import {
  getQuote as _getQuote,
  getQuoteViaBnkrw as _getQuoteViaBnkrw,
  getBestQuote as _getBestQuote,
} from "@bankr-wallet/wchan-swap";
import type { SwapDirection, WchanQuote } from "@bankr-wallet/wchan-swap";
import { CHAIN_RPC_URLS } from "../../app/wagmiConfig";

function getRpcUrl(chainId: number): string {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) throw new Error(`No RPC URL for chain ${chainId}`);
  return rpcUrl;
}

export async function getQuote(
  _client: unknown,
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  return _getQuote(getRpcUrl(chainId), chainId, direction, amountIn);
}

export async function getQuoteViaBnkrw(
  _client: unknown,
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  return _getQuoteViaBnkrw(getRpcUrl(chainId), chainId, direction, amountIn);
}

export async function getBestQuote(
  client: unknown,
  chainId: number,
  direction: SwapDirection,
  amountIn: bigint
): Promise<WchanQuote> {
  return _getBestQuote(getRpcUrl(chainId), chainId, direction, amountIn);
}
