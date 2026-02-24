"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { getQuote, type SwapDirection, type WchanQuote } from "../../../lib/wchan-swap";

const DEBOUNCE_MS = 500;

interface UseSwapQuoteParams {
  chainId: number;
  direction: SwapDirection;
  amount: string; // human-readable (e.g. "0.1")
  enabled: boolean;
}

export function useSwapQuote({ chainId, direction, amount, enabled }: UseSwapQuoteParams) {
  const client = usePublicClient({ chainId });
  const [quote, setQuote] = useState<WchanQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!enabled || !amount || !client) {
      setQuote(null);
      setError(null);
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseEther(amount);
    } catch {
      setQuote(null);
      setError(null);
      return;
    }

    if (parsed <= 0n) {
      setQuote(null);
      return;
    }

    const id = ++abortRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const result = await getQuote(client, chainId, direction, parsed);
        if (abortRef.current === id) {
          setQuote(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (abortRef.current === id) {
          setQuote(null);
          setError(err instanceof Error ? err.message : "Quote failed");
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (abortRef.current === id) {
        setIsLoading(false);
      }
    };
  }, [client, chainId, direction, amount, enabled]);

  const refetch = useCallback(async () => {
    if (!client || !amount || !enabled) return null;
    let parsed: bigint;
    try {
      parsed = parseEther(amount);
    } catch {
      return null;
    }
    if (parsed <= 0n) return null;

    setIsLoading(true);
    setError(null);
    try {
      const result = await getQuote(client, chainId, direction, parsed);
      setQuote(result);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote failed");
      setIsLoading(false);
      return null;
    }
  }, [client, chainId, direction, amount, enabled]);

  return { quote, isLoading, error, refetch };
}
