"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createPublicClient,
  http,
  type TransactionReceipt,
} from "viem";
import { mainnet, base } from "viem/chains";
import {
  publicActionsL1,
  publicActionsL2,
  getWithdrawals,
  getWithdrawalStatus,
  getTimeToFinalize,
} from "viem/op-stack";
import { CHAIN_RPC_URLS } from "../wagmiConfig";
import type {
  BridgeHistoryEntry,
  WithdrawalStatus,
} from "./useBridgeHistory";

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

function createClients() {
  const l1Client = createPublicClient({
    chain: mainnet,
    transport: http(CHAIN_RPC_URLS[1]),
  }).extend(publicActionsL1());

  const l2Client = createPublicClient({
    chain: base,
    transport: http(CHAIN_RPC_URLS[8453]),
  }).extend(publicActionsL2());

  return { l1Client, l2Client };
}

async function fetchEntryStatus(
  entry: BridgeHistoryEntry,
  l1Client: ReturnType<typeof createClients>["l1Client"],
  l2Client: ReturnType<typeof createClients>["l2Client"],
  signal: { aborted: boolean },
): Promise<Partial<BridgeHistoryEntry> | null> {
  try {
    const receipt: TransactionReceipt =
      await l2Client.getTransactionReceipt({ hash: entry.txHash });
    if (signal.aborted) return null;

    // Fetch block timestamp if we don't have it yet
    let txTimestamp = entry.txTimestamp;
    if (!txTimestamp) {
      try {
        const block = await l2Client.getBlock({
          blockNumber: receipt.blockNumber,
        });
        txTimestamp = Number(block.timestamp) * 1000;
      } catch {
        // ignore
      }
    }
    if (signal.aborted) return null;

    const withdrawals = getWithdrawals(receipt);
    const withdrawal = withdrawals[0];

    const status: WithdrawalStatus = await getWithdrawalStatus(l1Client, {
      receipt,
      targetChain: base,
    });
    if (signal.aborted) return null;

    // Fetch time estimate for waiting states
    let estimateSeconds: number | null = null;
    let estimateTimestamp: number | null = null;

    if (status === "waiting-to-finalize" && withdrawal) {
      try {
        const ttf = await getTimeToFinalize(l1Client, {
          targetChain: base,
          withdrawalHash: withdrawal.withdrawalHash as `0x${string}`,
        });
        estimateSeconds = Number(ttf.seconds);
        estimateTimestamp = Number(ttf.timestamp) * 1000;
      } catch {
        // dispute game may not be resolved yet
      }
    } else if (status === "waiting-to-prove" && txTimestamp) {
      const estimatedReadyAt = txTimestamp + 60 * 60 * 1000;
      const remaining = Math.max(
        0,
        Math.floor((estimatedReadyAt - Date.now()) / 1000),
      );
      estimateSeconds = remaining;
      estimateTimestamp = estimatedReadyAt;
    }
    if (signal.aborted) return null;

    return {
      lastStatus: status,
      lastCheckedAt: Date.now(),
      done: status === "finalized",
      estimateSeconds,
      estimateTimestamp,
      ...(txTimestamp ? { txTimestamp } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Shared hook that polls bridge history entry statuses.
 * Runs background polling every 3 minutes and exposes a manual refresh.
 */
export function useBridgeStatusPoller(
  entries: BridgeHistoryEntry[],
  updateEntry: (txHash: string, partial: Partial<BridgeHistoryEntry>) => void,
) {
  const [isPolling, setIsPolling] = useState(false);
  const abortRef = useRef({ aborted: false });
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const fetchAll = useCallback(async () => {
    const pending = entriesRef.current.filter((e) => !e.done);
    if (pending.length === 0) return;

    const signal = { aborted: false };
    abortRef.current = signal;
    setIsPolling(true);

    try {
      const { l1Client, l2Client } = createClients();
      for (const entry of pending) {
        if (signal.aborted) break;
        const update = await fetchEntryStatus(entry, l1Client, l2Client, signal);
        if (update && !signal.aborted) {
          updateEntry(entry.txHash, update);
        }
      }
    } finally {
      if (!signal.aborted) {
        setIsPolling(false);
      }
    }
  }, [updateEntry]);

  // Background polling
  useEffect(() => {
    const hasPending = entries.some((e) => !e.done);
    if (!hasPending) return;

    // Initial fetch
    fetchAll();

    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      abortRef.current.aborted = true;
      clearInterval(interval);
    };
  }, [entries.length, fetchAll]); // re-setup when entry count changes

  const refreshNow = useCallback(() => {
    // Abort any in-flight fetch and start fresh
    abortRef.current.aborted = true;
    fetchAll();
  }, [fetchAll]);

  return { isPolling, refreshNow };
}
