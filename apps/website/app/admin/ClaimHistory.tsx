"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Skeleton,
  Flex,
  IconButton,
} from "@chakra-ui/react";
import { ExternalLink, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { formatUnits } from "viem";
import CumulativeChart from "./CumulativeChart";
import ClaimHeatmap from "./ClaimHeatmap";

const FEE_INDEXER_API_URL =
  process.env.NEXT_PUBLIC_FEE_INDEXER_API_URL || "http://localhost:42071";

interface ClaimedStats {
  clankerEth: string;
  clankerBnkrw: string;
  hookEth: string;
  totalEth: string;
  totalBnkrw: string;
}

interface ClaimEvent {
  source: "clanker" | "hook";
  token: "WETH" | "BNKRW";
  amount: string;
  timestamp: number;
  transactionHash: string;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01 && value > 0) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

interface ClaimHistoryProps {
  ethPrice: number | null;
  bnkrwPrice: number | null;
  /** Increment this to trigger a refetch (e.g. after a claim confirms) */
  refreshKey: number;
}

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

export default function ClaimHistory({ ethPrice, bnkrwPrice, refreshKey }: ClaimHistoryProps) {
  const [claimedStats, setClaimedStats] = useState<ClaimedStats | null>(null);
  const [claimEvents, setClaimEvents] = useState<ClaimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchHistory = useCallback(async () => {
    try {
      const [statsRes, claimsRes] = await Promise.all([
        fetch(`${FEE_INDEXER_API_URL}/stats`),
        fetch(`${FEE_INDEXER_API_URL}/claims`),
      ]);
      if (statsRes.ok) setClaimedStats(await statsRes.json());
      if (claimsRes.ok) setClaimEvents(await claimsRes.json());
    } catch (err) {
      console.error("Failed to fetch fee history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll every 30s + refetch on refreshKey
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30_000);
    return () => clearInterval(interval);
  }, [fetchHistory, refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory().finally(() => setTimeout(() => setIsRefreshing(false), 600));
  };

  const historicalEthFloat = claimedStats
    ? parseFloat(formatUnits(BigInt(claimedStats.totalEth), 18))
    : 0;
  const historicalBnkrwFloat = claimedStats
    ? parseFloat(formatUnits(BigInt(claimedStats.totalBnkrw), 18))
    : 0;

  const getUsdValue = useCallback(
    (evt: ClaimEvent) => {
      const amtFloat = parseFloat(formatUnits(BigInt(evt.amount), 18));
      const price = evt.token === "WETH" ? ethPrice : bnkrwPrice;
      return price ? amtFloat * price : 0;
    },
    [ethPrice, bnkrwPrice]
  );

  const sortedEvents = useMemo(() => {
    const sorted = [...claimEvents];
    sorted.sort((a, b) => {
      let cmp: number;
      if (sortField === "date") {
        cmp = a.timestamp - b.timestamp;
      } else {
        cmp = getUsdValue(a) - getUsdValue(b);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [claimEvents, sortField, sortDir, getUsdValue]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <Box
      bg="white"
      border={{ base: "2px solid", lg: "4px solid" }}
      borderColor="bauhaus.border"
      boxShadow={{ base: "3px 3px 0px 0px #121212", lg: "8px 8px 0px 0px #121212" }}
      position="relative"
      overflow="hidden"
    >
      <Box h="6px" bg="bauhaus.blue" />

      <Box p={{ base: 5, lg: 8 }}>
        <HStack mb={4} spacing={3}>
          <Box w={2} h={2} bg="bauhaus.blue" borderRadius="full" />
          <Text
            fontWeight="bold"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="widest"
            color="gray.500"
          >
            Total Claimed (Historical)
          </Text>
          <IconButton
            aria-label="Refresh history"
            icon={
              <Box
                as={RefreshCw}
                size={14}
                animation={isRefreshing ? "spin 0.6s linear infinite" : undefined}
                sx={{
                  "@keyframes spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              />
            }
            size="xs"
            variant="ghost"
            color="gray.400"
            _hover={{ color: "bauhaus.black" }}
            onClick={handleRefresh}
          />
        </HStack>

        {/* Stats summary */}
        {loading ? (
          <Skeleton h="40px" w="280px" mb={6} />
        ) : claimedStats ? (
          <VStack spacing={4} align="start" mb={6}>
            {/* Total USD */}
            {(ethPrice || bnkrwPrice) && (
              <Text
                fontWeight="black"
                fontSize={{ base: "4xl", lg: "5xl" }}
                lineHeight="1"
                letterSpacing="tighter"
              >
                {formatUsd(
                  (ethPrice ? historicalEthFloat * ethPrice : 0) +
                    (bnkrwPrice ? historicalBnkrwFloat * bnkrwPrice : 0)
                )}
              </Text>
            )}
            <HStack spacing={6}>
              <VStack spacing={0} align="start">
                <Text fontWeight="black" fontSize={{ base: "2xl", lg: "3xl" }} lineHeight="1">
                  {historicalEthFloat.toLocaleString(undefined, {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}{" "}
                  <Text as="span" fontSize="lg" color="bauhaus.blue">
                    ETH
                  </Text>
                </Text>
                {ethPrice && (
                  <Text fontSize="sm" color="gray.400" fontWeight="medium">
                    {formatUsd(historicalEthFloat * ethPrice)}
                  </Text>
                )}
              </VStack>
              <Box w="2px" h="40px" bg="bauhaus.border" opacity={0.2} />
              <VStack spacing={0} align="start">
                <Text fontWeight="black" fontSize={{ base: "2xl", lg: "3xl" }} lineHeight="1">
                  {formatLargeNumber(historicalBnkrwFloat)}{" "}
                  <Text as="span" fontSize="lg" color="bauhaus.red">
                    BNKRW
                  </Text>
                </Text>
                {bnkrwPrice && (
                  <Text fontSize="sm" color="gray.400" fontWeight="medium">
                    {formatUsd(historicalBnkrwFloat * bnkrwPrice)}
                  </Text>
                )}
              </VStack>
            </HStack>
          </VStack>
        ) : (
          <Text fontSize="sm" color="gray.400" mb={6}>
            Failed to load historical data
          </Text>
        )}

        {/* Breakdown by source */}
        {claimedStats && !loading && (
          <Flex gap={4} mb={6} wrap="wrap">
            {BigInt(claimedStats.clankerEth) > 0n && (
              <HStack bg="gray.50" border="1px solid" borderColor="gray.200" px={3} py={1.5}>
                <Box w={1.5} h={1.5} bg="bauhaus.red" borderRadius="full" />
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
                  Clanker ETH
                </Text>
                <Text fontSize="xs" fontWeight="bold">
                  {parseFloat(formatUnits(BigInt(claimedStats.clankerEth), 18)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 4 }
                  )}
                </Text>
              </HStack>
            )}
            {BigInt(claimedStats.hookEth) > 0n && (
              <HStack bg="gray.50" border="1px solid" borderColor="gray.200" px={3} py={1.5}>
                <Box w={1.5} h={1.5} bg="bauhaus.blue" borderRadius="full" />
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
                  Hook ETH
                </Text>
                <Text fontSize="xs" fontWeight="bold">
                  {parseFloat(formatUnits(BigInt(claimedStats.hookEth), 18)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 4 }
                  )}
                </Text>
              </HStack>
            )}
            {BigInt(claimedStats.clankerBnkrw) > 0n && (
              <HStack bg="gray.50" border="1px solid" borderColor="gray.200" px={3} py={1.5}>
                <Box w={1.5} h={1.5} bg="bauhaus.red" borderRadius="full" />
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
                  Clanker BNKRW
                </Text>
                <Text fontSize="xs" fontWeight="bold">
                  {formatLargeNumber(
                    parseFloat(formatUnits(BigInt(claimedStats.clankerBnkrw), 18))
                  )}
                </Text>
              </HStack>
            )}
          </Flex>
        )}

        {/* Cumulative chart */}
        {!loading && claimEvents.length >= 2 && (
          <Box mb={6}>
            <Text
              fontWeight="bold"
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="widest"
              color="gray.500"
              mb={3}
            >
              Cumulative USD Claimed
            </Text>
            <Box
              border="2px solid"
              borderColor="bauhaus.border"
              boxShadow="3px 3px 0px 0px #121212"
              overflow="hidden"
              bg="white"
            >
              <CumulativeChart
                events={claimEvents}
                ethPrice={ethPrice}
                bnkrwPrice={bnkrwPrice}
              />
            </Box>
          </Box>
        )}

        {/* Heatmap */}
        {!loading && claimEvents.length > 0 && (
          <Box mb={6}>
            <Text
              fontWeight="bold"
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="widest"
              color="gray.500"
              mb={3}
            >
              Claim Activity
            </Text>
            <Box
              border="2px solid"
              borderColor="bauhaus.border"
              boxShadow="3px 3px 0px 0px #121212"
              p={4}
              bg="white"
            >
              <ClaimHeatmap
                events={claimEvents}
                ethPrice={ethPrice}
                bnkrwPrice={bnkrwPrice}
              />
            </Box>
          </Box>
        )}

        {/* Claims table */}
        <Text
          fontWeight="bold"
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="widest"
          color="gray.500"
          mb={3}
        >
          Claim History
        </Text>

        {loading ? (
          <VStack spacing={2} align="stretch">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} h="44px" />
            ))}
          </VStack>
        ) : claimEvents.length === 0 ? (
          <Text fontSize="sm" color="gray.400">
            No claims found
          </Text>
        ) : (
          <Box border="2px solid" borderColor="bauhaus.border" overflow="hidden">
            {/* Table header (sticky) */}
            <Flex
              bg="gray.50"
              borderBottom="2px solid"
              borderColor="bauhaus.border"
              px={4}
              py={2}
            >
              <HStack
                flex={1}
                spacing={1}
                cursor="pointer"
                onClick={() => toggleSort("date")}
                _hover={{ color: "bauhaus.black" }}
                role="button"
              >
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={sortField === "date" ? "bauhaus.black" : "gray.500"}>
                  Date
                </Text>
                {sortField === "date" && (
                  <Box as={sortDir === "asc" ? ChevronUp : ChevronDown} size={12} color="bauhaus.black" />
                )}
              </HStack>
              <Text flex={1} fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color="gray.500">
                Source
              </Text>
              <Text flex={1} fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color="gray.500">
                Token
              </Text>
              <HStack
                flex={1.5}
                spacing={1}
                justify="flex-end"
                cursor="pointer"
                onClick={() => toggleSort("amount")}
                _hover={{ color: "bauhaus.black" }}
                role="button"
              >
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={sortField === "amount" ? "bauhaus.black" : "gray.500"}>
                  Amount
                </Text>
                {sortField === "amount" && (
                  <Box as={sortDir === "asc" ? ChevronUp : ChevronDown} size={12} color="bauhaus.black" />
                )}
              </HStack>
              <Box w="36px" />
            </Flex>

            {/* Scrollable table body */}
            <Box maxH="400px" overflowY="auto">
            {sortedEvents.map((evt, i) => {
              const amtFloat = parseFloat(formatUnits(BigInt(evt.amount), 18));
              const date = new Date(evt.timestamp * 1000);
              const price = evt.token === "WETH" ? ethPrice : bnkrwPrice;
              const usdVal = price ? amtFloat * price : null;
              return (
                <Flex
                  key={`${evt.transactionHash}-${i}`}
                  px={4}
                  py={3}
                  borderBottom={i < sortedEvents.length - 1 ? "1px solid" : undefined}
                  borderColor="gray.100"
                  align="center"
                  _hover={{ bg: "gray.50" }}
                  transition="background 0.1s"
                >
                  <Text flex={1} fontSize="sm" color="gray.600">
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <HStack flex={1} spacing={1.5}>
                    <Box
                      w={1.5}
                      h={1.5}
                      borderRadius="full"
                      bg={evt.source === "clanker" ? "bauhaus.red" : "bauhaus.blue"}
                    />
                    <Text fontSize="sm" fontWeight="bold" textTransform="capitalize">
                      {evt.source}
                    </Text>
                  </HStack>
                  <Text
                    flex={1}
                    fontSize="sm"
                    fontWeight="bold"
                    color={evt.token === "WETH" ? "bauhaus.blue" : "bauhaus.red"}
                  >
                    {evt.token === "WETH" ? "ETH" : "BNKRW"}
                  </Text>
                  <VStack flex={1.5} spacing={0} align="end">
                    {usdVal !== null ? (
                      <Text fontSize="sm" fontWeight="bold">
                        {formatUsd(usdVal)}
                      </Text>
                    ) : (
                      <Text fontSize="sm" fontWeight="bold">
                        {evt.token === "BNKRW"
                          ? formatLargeNumber(amtFloat)
                          : amtFloat.toLocaleString(undefined, {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 6,
                            })}
                      </Text>
                    )}
                    <Text fontSize="xs" color="gray.400" fontWeight="medium">
                      {evt.token === "BNKRW"
                        ? formatLargeNumber(amtFloat)
                        : amtFloat.toLocaleString(undefined, {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 6,
                          })}{" "}
                      {evt.token === "WETH" ? "ETH" : "BNKRW"}
                    </Text>
                  </VStack>
                  <Box w="36px" textAlign="right">
                    <IconButton
                      aria-label="View on BaseScan"
                      icon={<ExternalLink size={14} />}
                      size="xs"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: "bauhaus.blue" }}
                      as="a"
                      href={`https://basescan.org/tx/${evt.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  </Box>
                </Flex>
              );
            })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
