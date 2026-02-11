import { useState, useEffect, useCallback, useRef } from "react";
import { parseEther, formatUnits } from "viem";
import { NATIVE_TOKEN_ADDRESS } from "../constants";

export type { SwapQuote } from "../types";
import type { SwapQuote } from "../types";

interface UseSwapQuoteParams {
  sellToken: string;
  buyToken: string;
  sellAmountEth: string; // Human-readable ETH amount
  taker?: string;
  slippageBps?: number;
  enabled?: boolean;
}

export function useSwapQuote({
  sellToken,
  buyToken,
  sellAmountEth,
  taker,
  slippageBps,
  enabled = true,
}: UseSwapQuoteParams) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!sellToken || !buyToken || !sellAmountEth || !enabled) {
      setQuote(null);
      setError(null);
      return;
    }

    // Parse ETH amount to wei
    let sellAmountWei: string;
    try {
      const parsed = parseEther(sellAmountEth);
      if (parsed <= 0n) {
        setQuote(null);
        setError(null);
        return;
      }
      sellAmountWei = parsed.toString();
    } catch {
      setError("Invalid amount");
      return;
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount: sellAmountWei,
      });
      if (taker) {
        params.set("taker", taker);
      }
      if (slippageBps !== undefined) {
        params.set("slippageBps", slippageBps.toString());
      }

      const response = await fetch(`/api/swap/price?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || data.reason || `API error: ${response.status}`
        );
      }

      const data: SwapQuote = await response.json();

      if (!data.liquidityAvailable) {
        setError("No liquidity available for this pair");
        setQuote(null);
      } else {
        setQuote(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch price"
      );
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [sellToken, buyToken, sellAmountEth, taker, slippageBps, enabled]);

  // Debounced auto-fetch on input change (no periodic refresh)
  useEffect(() => {
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [fetchPrice]);

  // Fetch firm quote (called before executing swap)
  const fetchFirmQuote = useCallback(
    async (takerAddress: string): Promise<SwapQuote | null> => {
      if (!sellToken || !buyToken || !sellAmountEth) return null;

      let sellAmountWei: string;
      try {
        sellAmountWei = parseEther(sellAmountEth).toString();
      } catch {
        return null;
      }

      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount: sellAmountWei,
        taker: takerAddress,
      });
      if (slippageBps !== undefined) {
        params.set("slippageBps", slippageBps.toString());
      }

      const response = await fetch(`/api/swap/quote?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || data.reason || `API error: ${response.status}`
        );
      }

      return response.json();
    },
    [sellToken, buyToken, sellAmountEth, slippageBps]
  );

  return { quote, isLoading, error, refetch: fetchPrice, fetchFirmQuote };
}

export function formatTokenAmount(
  amount: string,
  decimals: number,
  displayDecimals = 6
): string {
  const formatted = formatUnits(BigInt(amount), decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.000001) return "< 0.000001";
  return num.toFixed(displayDecimals).replace(/\.?0+$/, "");
}
