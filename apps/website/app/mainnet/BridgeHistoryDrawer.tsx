"use client";

import { useEffect, useRef } from "react";
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Link,
  IconButton,
  Spinner,
  Flex,
} from "@chakra-ui/react";
import { X, ExternalLink as ExternalLinkIcon } from "lucide-react";
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
import { mainnetHref } from "./useMainnetUrl";

interface BridgeHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: BridgeHistoryEntry[];
  updateEntry: (txHash: string, partial: Partial<BridgeHistoryEntry>) => void;
  removeEntry: (txHash: string) => void;
}

function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Ready now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

/** Priority: ready-to-* (actionable) first, then waiting by least time left, then done last */
function sortEntries(a: BridgeHistoryEntry, b: BridgeHistoryEntry): number {
  const priority = (e: BridgeHistoryEntry): number => {
    if (e.done || e.lastStatus === "finalized") return 3;
    if (
      e.lastStatus === "ready-to-prove" ||
      e.lastStatus === "ready-to-finalize"
    )
      return 0;
    if (
      e.lastStatus === "waiting-to-prove" ||
      e.lastStatus === "waiting-to-finalize"
    )
      return 1;
    return 2; // null / checking
  };

  const pa = priority(a);
  const pb = priority(b);
  if (pa !== pb) return pa - pb;

  // Within same priority, sort by least time remaining (most urgent first)
  const ta = a.estimateSeconds ?? Infinity;
  const tb = b.estimateSeconds ?? Infinity;
  if (ta !== tb) return ta - tb;

  // Fallback: newest first
  return b.addedAt - a.addedAt;
}

function cardBgColor(status: WithdrawalStatus | null): string {
  switch (status) {
    case "waiting-to-prove":
      return "orange.50";
    case "waiting-to-finalize":
      return "purple.50";
    case "ready-to-prove":
    case "ready-to-finalize":
      return "blue.50";
    case "finalized":
      return "green.50";
    default:
      return "white";
  }
}

function statusBadgeProps(status: WithdrawalStatus | null): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "waiting-to-prove":
      return { bg: "yellow.300", color: "black", label: "Waiting to Prove" };
    case "ready-to-prove":
      return { bg: "bauhaus.blue", color: "white", label: "Ready to Prove" };
    case "waiting-to-finalize":
      return {
        bg: "yellow.300",
        color: "black",
        label: "Waiting to Finalize",
      };
    case "ready-to-finalize":
      return {
        bg: "bauhaus.blue",
        color: "white",
        label: "Ready to Finalize",
      };
    case "finalized":
      return { bg: "green.500", color: "white", label: "Finalized" };
    default:
      return { bg: "gray.200", color: "gray.600", label: "Checking..." };
  }
}

export default function BridgeHistoryDrawer({
  isOpen,
  onClose,
  entries,
  updateEntry,
  removeEntry,
}: BridgeHistoryDrawerProps) {
  const abortRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current = true;
      return;
    }

    abortRef.current = false;

    const pendingEntries = entries.filter((e) => !e.done);
    if (pendingEntries.length === 0) return;

    const l1Client = createPublicClient({
      chain: mainnet,
      transport: http(CHAIN_RPC_URLS[1]),
    }).extend(publicActionsL1());

    const l2Client = createPublicClient({
      chain: base,
      transport: http(CHAIN_RPC_URLS[8453]),
    }).extend(publicActionsL2());

    (async () => {
      for (const entry of pendingEntries) {
        if (abortRef.current) break;

        try {
          const receipt: TransactionReceipt =
            await l2Client.getTransactionReceipt({
              hash: entry.txHash,
            });

          if (abortRef.current) break;

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

          if (abortRef.current) break;

          const withdrawals = getWithdrawals(receipt);
          const withdrawal = withdrawals[0];

          const status: WithdrawalStatus = await getWithdrawalStatus(
            l1Client,
            {
              receipt,
              targetChain: base,
            }
          );

          if (abortRef.current) break;

          // Fetch time estimate for waiting states
          let estimateSeconds: number | null = null;
          let estimateTimestamp: number | null = null;

          if (status === "waiting-to-finalize" && withdrawal) {
            try {
              const ttf = await getTimeToFinalize(l1Client, {
                targetChain: base,
                withdrawalHash:
                  withdrawal.withdrawalHash as `0x${string}`,
              });
              estimateSeconds = Number(ttf.seconds);
              estimateTimestamp = Number(ttf.timestamp) * 1000;
            } catch {
              // dispute game may not be resolved yet
            }
          } else if (status === "waiting-to-prove" && txTimestamp) {
            // Dispute game usually posted ~1h after tx
            const estimatedReadyAt = txTimestamp + 60 * 60 * 1000;
            const remaining = Math.max(
              0,
              Math.floor((estimatedReadyAt - Date.now()) / 1000)
            );
            estimateSeconds = remaining;
            estimateTimestamp = estimatedReadyAt;
          }

          if (abortRef.current) break;

          updateEntry(entry.txHash, {
            lastStatus: status,
            lastCheckedAt: Date.now(),
            done: status === "finalized",
            estimateSeconds,
            estimateTimestamp,
            ...(txTimestamp ? { txTimestamp } : {}),
          });
        } catch {
          // skip entry on error
        }
      }
    })();

    return () => {
      abortRef.current = true;
    };
    // Only re-run when drawer opens/closes, not on every entries change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent
        bg="white"
        borderLeft="4px solid"
        borderColor="bauhaus.border"
      >
        <DrawerCloseButton />
        <DrawerHeader
          fontWeight="900"
          textTransform="uppercase"
          letterSpacing="wide"
          fontSize="lg"
          borderBottom="3px solid"
          borderColor="bauhaus.border"
        >
          Bridge History
        </DrawerHeader>
        <DrawerBody px={4} py={4}>
          {entries.length === 0 ? (
            <Flex
              h="200px"
              align="center"
              justify="center"
              direction="column"
              gap={2}
            >
              <Text
                fontSize="sm"
                fontWeight="700"
                color="gray.400"
                textTransform="uppercase"
              >
                No bridge transactions yet
              </Text>
            </Flex>
          ) : (
            <VStack spacing={3} align="stretch">
              {[...entries].sort(sortEntries).map((entry) => {
                const badge = statusBadgeProps(entry.lastStatus);
                const cardBg = cardBgColor(entry.lastStatus);
                return (
                  <Box
                    key={entry.txHash}
                    border="3px solid"
                    borderColor="bauhaus.border"
                    boxShadow="4px 4px 0px 0px #121212"
                    bg={cardBg}
                    p={4}
                  >
                    <VStack spacing={2} align="stretch">
                      <HStack justify="space-between" align="start">
                        <VStack align="start" spacing={1}>
                          {entry.tokenSymbol && entry.amount && (
                            <Text fontSize="md" fontWeight="900">
                              {entry.amount} {entry.tokenSymbol}
                            </Text>
                          )}
                          <HStack spacing={1}>
                            <Text
                              fontFamily="mono"
                              fontSize="xs"
                              color="gray.600"
                            >
                              {shortenHash(entry.txHash)}
                            </Text>
                            <Link
                              href={`https://basescan.org/tx/${entry.txHash}`}
                              isExternal
                            >
                              <ExternalLinkIcon size={12} />
                            </Link>
                          </HStack>
                        </VStack>
                        {entry.done && (
                          <IconButton
                            aria-label="Remove"
                            icon={<X size={14} />}
                            size="xs"
                            variant="ghost"
                            onClick={() => removeEntry(entry.txHash)}
                          />
                        )}
                      </HStack>

                      <HStack justify="space-between" align="center">
                        <Badge
                          bg={badge.bg}
                          color={badge.color}
                          px={2}
                          py={0.5}
                          borderRadius={0}
                          fontSize="xs"
                          fontWeight="800"
                          textTransform="uppercase"
                        >
                          {entry.lastStatus === null ? (
                            <HStack spacing={1}>
                              <Spinner size="xs" />
                              <Text>{badge.label}</Text>
                            </HStack>
                          ) : (
                            badge.label
                          )}
                        </Badge>
                        <Text fontSize="xs" color="gray.400" fontWeight="700">
                          {relativeTime(entry.txTimestamp ?? entry.addedAt)}
                        </Text>
                      </HStack>

                      {entry.estimateSeconds != null &&
                        entry.estimateSeconds > 0 &&
                        (entry.lastStatus === "waiting-to-prove" ||
                          entry.lastStatus === "waiting-to-finalize") && (
                          <Text fontSize="xs" color="gray.500">
                            <Text as="span" fontWeight="800">~{formatDuration(entry.estimateSeconds)}</Text> remaining
                            {entry.estimateTimestamp && (
                              <Text as="span" color="gray.400">
                                {" "}
                                (≈{" "}
                                {new Date(
                                  entry.estimateTimestamp
                                ).toLocaleString()}
                                )
                              </Text>
                            )}
                          </Text>
                        )}

                      {!entry.done && entry.lastStatus && (
                        <Link
                          href={mainnetHref(`/mainnet/claim?tx=${entry.txHash}`)}
                          fontSize="xs"
                          fontWeight="800"
                          color="bauhaus.blue"
                          textTransform="uppercase"
                          _hover={{
                            color: "bauhaus.red",
                            textDecoration: "none",
                          }}
                        >
                          Track & Claim →
                        </Link>
                      )}
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
