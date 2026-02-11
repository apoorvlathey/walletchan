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

const POLL_INTERVAL = 5000;
const MAX_BACKOFF = 30000;
const BASE_BACKOFF = 1000;
const DISCONNECT_AFTER = 3; // consecutive failures before marking disconnected
const PAGE_SIZE = 200;

export function useCoinsStream() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [totalCoins, setTotalCoins] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Track latest timestamp to detect new coins
  const latestTimestampRef = useRef<string>("0");
  // Track how many new coins were prepended via polling so offset stays correct
  const newCountRef = useRef(0);
  // Guard against overlapping polls
  const pollActiveRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (pollActiveRef.current || !mountedRef.current) return;
    pollActiveRef.current = true;

    try {
      const res = await fetch(
        `${INDEXER_API_URL}/coins?limit=50&offset=0`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Coin[] = await res.json();

      if (!mountedRef.current) return;

      consecutiveErrorsRef.current = 0;
      setIsConnected(true);

      const currentTs = latestTimestampRef.current;

      // Find coins newer than what we've seen (use >= for same-second coins, dedup by id)
      const newCoins = data.filter(
        (c) => c.timestamp >= currentTs
      );

      if (newCoins.length > 0) {
        setCoins((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const fresh = newCoins.filter((c) => !existingIds.has(c.id));
          if (fresh.length === 0) return prev;
          newCountRef.current += fresh.length;
          setTotalCoins((t) => t + fresh.length);
          return [...fresh, ...prev];
        });

        // Update latest timestamp
        const maxTs = newCoins.reduce(
          (max, c) => (c.timestamp > max ? c.timestamp : max),
          currentTs
        );
        latestTimestampRef.current = maxTs;
      }

      // Schedule next poll at normal interval
      if (mountedRef.current) {
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    } catch {
      consecutiveErrorsRef.current += 1;
      const errors = consecutiveErrorsRef.current;

      if (errors >= DISCONNECT_AFTER) {
        setIsConnected(false);
      }

      // Exponential backoff
      const delay = Math.min(
        BASE_BACKOFF * 2 ** (errors - 1),
        MAX_BACKOFF
      );
      if (mountedRef.current) {
        pollTimerRef.current = setTimeout(poll, delay);
      }
    } finally {
      pollActiveRef.current = false;
    }
  }, []);

  // Load more (older) coins
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      // Current REST-fetched count = total coins minus polling-prepended ones
      const restCount = coins.length - newCountRef.current;
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
    mountedRef.current = true;

    async function init() {
      try {
        // Fetch initial page + stats in parallel
        const [coinsRes, statsRes] = await Promise.all([
          fetch(`${INDEXER_API_URL}/coins?limit=${PAGE_SIZE}&offset=0`),
          fetch(`${INDEXER_API_URL}/stats`),
        ]);

        if (!mountedRef.current) return;

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

        // Record latest timestamp for polling comparison
        if (initialCoins.length > 0) {
          latestTimestampRef.current = initialCoins[0].timestamp;
        }

        // Start polling for new coins
        if (mountedRef.current) {
          setIsConnected(true);
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
        }
      } catch {
        if (mountedRef.current) {
          setIsLoading(false);
          // Start polling even on init failure — it will retry
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
        }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [poll]);

  return { coins, totalCoins, isConnected, isLoading, isLoadingMore, hasMore, loadMore };
}
