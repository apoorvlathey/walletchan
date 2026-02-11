"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { INDEXER_API_URL } from "../../constants";

export interface Coin {
  id: string;
  coinAddress: string;
  poolId: string | null;
  name: string;
  symbol: string;
  tokenURI: string;
  tweetUrl: string | null;
  creatorAddress: string;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
}

interface Stats {
  totalCoins: number;
  latestCoin: Coin | null;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;
const PAGE_SIZE = 200;

export function useCoinsStream() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [totalCoins, setTotalCoins] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track how many SSE coins were prepended so offset stays correct
  const sseCountRef = useRef(0);

  const connectSSE = useCallback((sinceTimestamp?: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = sinceTimestamp ? `?since=${sinceTimestamp}` : "";
    const es = new EventSource(`${INDEXER_API_URL}/coins/stream${params}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      reconnectAttemptRef.current = 0;
    };

    es.addEventListener("coin", (event) => {
      try {
        const coin: Coin = JSON.parse(event.data);
        setCoins((prev) => {
          if (prev.some((c) => c.id === coin.id)) return prev;
          sseCountRef.current += 1;
          return [coin, ...prev];
        });
        setTotalCoins((prev) => prev + 1);
      } catch {
        // Ignore malformed events
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();

      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** reconnectAttemptRef.current,
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        setCoins((prev) => {
          const latest = prev[0]?.timestamp;
          connectSSE(latest);
          return prev;
        });
      }, delay);
    };
  }, []);

  // Load more (older) coins
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      // Current REST-fetched count = total coins minus SSE-prepended ones
      const restCount = coins.length - sseCountRef.current;
      const res = await fetch(
        `${INDEXER_API_URL}/coins?limit=${PAGE_SIZE}&offset=${restCount}`
      );
      if (res.ok) {
        const data: Coin[] = await res.json();
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        }
        if (data.length > 0) {
          setCoins((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newCoins = data.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newCoins];
          });
        }
      }
    } catch {
      // Silently fail, user can retry
    } finally {
      setIsLoadingMore(false);
    }
  }, [coins.length, isLoadingMore, hasMore]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Fetch initial page + stats in parallel
        const [coinsRes, statsRes] = await Promise.all([
          fetch(`${INDEXER_API_URL}/coins?limit=${PAGE_SIZE}&offset=0`),
          fetch(`${INDEXER_API_URL}/stats`),
        ]);

        if (cancelled) return;

        let initialCoins: Coin[] = [];

        if (coinsRes.ok) {
          initialCoins = await coinsRes.json();
          setCoins(initialCoins);
          if (initialCoins.length < PAGE_SIZE) {
            setHasMore(false);
          }
        }

        if (statsRes.ok) {
          const stats: Stats = await statsRes.json();
          setTotalCoins(stats.totalCoins);
        }

        setIsLoading(false);

        // Start SSE from the latest coin's timestamp
        const latestTimestamp = initialCoins[0]?.timestamp;
        if (!cancelled) {
          connectSSE(latestTimestamp);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
          connectSSE();
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSSE]);

  return { coins, totalCoins, isConnected, isLoading, isLoadingMore, hasMore, loadMore };
}
