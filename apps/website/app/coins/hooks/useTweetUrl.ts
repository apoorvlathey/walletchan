"use client";

import { useState, useEffect } from "react";

// Module-level cache: IPFS content is immutable so results never change
const tweetUrlCache = new Map<string, string | null>();
// Dedup in-flight requests so multiple components with the same hash share one fetch
const inflightRequests = new Map<string, Promise<string | null>>();

async function resolveTweetUrl(ipfsHash: string): Promise<string | null> {
  if (tweetUrlCache.has(ipfsHash)) {
    return tweetUrlCache.get(ipfsHash)!;
  }

  if (inflightRequests.has(ipfsHash)) {
    return inflightRequests.get(ipfsHash)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/resolve-ipfs?hash=${encodeURIComponent(ipfsHash)}`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { tweetUrl: string | null };
      tweetUrlCache.set(ipfsHash, data.tweetUrl);
      return data.tweetUrl;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(ipfsHash);
    }
  })();

  inflightRequests.set(ipfsHash, promise);
  return promise;
}

/**
 * Resolves the tweet URL for a coin from its IPFS tokenURI metadata.
 * - If the indexer already provided a tweetUrl, returns it immediately.
 * - Otherwise calls /api/resolve-ipfs once and caches the result.
 */
export function useTweetUrl(
  tokenURI: string | null | undefined,
  existingTweetUrl: string | null | undefined
): string | null {
  const [tweetUrl, setTweetUrl] = useState<string | null>(
    existingTweetUrl ?? null
  );

  useEffect(() => {
    if (existingTweetUrl) {
      setTweetUrl(existingTweetUrl);
      return;
    }

    if (!tokenURI || !tokenURI.startsWith("ipfs://")) return;

    const ipfsHash = tokenURI.slice("ipfs://".length);
    if (!ipfsHash) return;

    // Check cache synchronously
    if (tweetUrlCache.has(ipfsHash)) {
      setTweetUrl(tweetUrlCache.get(ipfsHash) ?? null);
      return;
    }

    let cancelled = false;

    resolveTweetUrl(ipfsHash).then((result) => {
      if (!cancelled) {
        setTweetUrl(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tokenURI, existingTweetUrl]);

  return tweetUrl;
}
