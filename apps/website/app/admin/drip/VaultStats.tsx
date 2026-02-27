"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Flex,
  Skeleton,
  IconButton,
} from "@chakra-ui/react";
import { RefreshCw } from "lucide-react";
import { formatUnits } from "viem";

const INDEXER_URL =
  process.env.NEXT_PUBLIC_WCHAN_VAULT_INDEXER_API_URL || "";
const INDEXER_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_WCHAN_VAULT_INDEXER_CHAIN_ID || "0"
);

const POLL_MS = 30_000;

interface ApyData {
  wchanAPY: number;
  sharePrice: string;
  totalStaked: string;
  totalShares: string;
  window: string;
  secondsElapsed: number;
  wethDistributed: string;
}

interface StatsData {
  totalEvents: number;
  donateEvents: number;
  donateRewardEvents: number;
  penaltyEvents: number;
  totalWchanDonated: string;
  totalWethDistributed: string;
  currentSharePrice: string;
  totalStaked: string;
  totalShares: string;
}

function fmtWei(wei: string, decimals = 4): string {
  const num = parseFloat(formatUnits(BigInt(wei || "0"), 18));
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 6,
  });
}

function fmtSharePrice(raw: string): string {
  const num = parseFloat(formatUnits(BigInt(raw || "0"), 18));
  if (num === 0) return "1.0000";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

// WETH APY = (wethDistributed_USD / totalStaked_USD) * (secondsPerYear / secondsElapsed) * 100
function computeWethApy(
  wethDistributed: string,
  totalStaked: string,
  secondsElapsed: number,
  ethPrice: number | null,
  wchanPrice: number | null
): number | null {
  if (!ethPrice || !wchanPrice || secondsElapsed <= 0) return null;
  const wethUsd =
    parseFloat(formatUnits(BigInt(wethDistributed || "0"), 18)) * ethPrice;
  const stakedUsd =
    parseFloat(formatUnits(BigInt(totalStaked || "0"), 18)) * wchanPrice;
  if (stakedUsd === 0) return null;
  return (wethUsd / stakedUsd) * (31_536_000 / secondsElapsed) * 100;
}

interface VaultStatsProps {
  selectedChainId: number;
  ethPrice: number | null;
  wchanPrice: number | null;
}

export default function VaultStats({
  selectedChainId,
  ethPrice,
  wchanPrice,
}: VaultStatsProps) {
  const [apy7d, setApy7d] = useState<ApyData | null>(null);
  const [apy30d, setApy30d] = useState<ApyData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!INDEXER_URL) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [apy7dRes, apy30dRes, statsRes] = await Promise.all([
        fetch(`${INDEXER_URL}/apy?window=7d`),
        fetch(`${INDEXER_URL}/apy?window=30d`),
        fetch(`${INDEXER_URL}/stats`),
      ]);
      if (apy7dRes.ok) setApy7d(await apy7dRes.json());
      if (apy30dRes.ok) setApy30d(await apy30dRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const wethApy7d = useMemo(
    () =>
      apy7d
        ? computeWethApy(apy7d.wethDistributed, apy7d.totalStaked, apy7d.secondsElapsed, ethPrice, wchanPrice)
        : null,
    [apy7d, ethPrice, wchanPrice]
  );

  const wethApy30d = useMemo(
    () =>
      apy30d
        ? computeWethApy(apy30d.wethDistributed, apy30d.totalStaked, apy30d.secondsElapsed, ethPrice, wchanPrice)
        : null,
    [apy30d, ethPrice, wchanPrice]
  );

  // Net APY = WCHAN APY + WETH APY
  const netApy7d =
    apy7d && wethApy7d !== null ? apy7d.wchanAPY + wethApy7d : null;
  const netApy30d =
    apy30d && wethApy30d !== null ? apy30d.wchanAPY + wethApy30d : null;

  if (!INDEXER_URL || !INDEXER_CHAIN_ID || selectedChainId !== INDEXER_CHAIN_ID)
    return null;

  return (
    <Box
      mt={4}
      bg="white"
      border="2px solid"
      borderColor="bauhaus.border"
      boxShadow="3px 3px 0px 0px #121212"
      position="relative"
      overflow="hidden"
    >
      <Box position="absolute" left={0} top={0} bottom={0} w="4px" bg="bauhaus.yellow" />
      <Box p={5} pl={6}>
        <HStack mb={3} spacing={3}>
          <Box w={1.5} h={1.5} bg="bauhaus.yellow" borderRadius="full" />
          <Text
            fontWeight="bold"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="widest"
            color="gray.500"
          >
            Vault Indexer Stats
          </Text>
          <IconButton
            aria-label="Refresh vault stats"
            icon={
              <Box
                as={RefreshCw}
                size={14}
                animation={refreshing ? "spin 1s linear infinite" : undefined}
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
            onClick={() => fetchData(true)}
          />
        </HStack>

        {loading ? (
          <VStack spacing={2} align="stretch">
            <Skeleton h="20px" />
            <Skeleton h="20px" />
            <Skeleton h="20px" />
          </VStack>
        ) : (
          <VStack spacing={3} align="stretch">
            {/* 7d and 30d columns side by side */}
            <Flex gap={4} direction={{ base: "column", md: "row" }}>
              {/* 7d Column */}
              <Box
                flex={1}
                p={4}
                bg="gray.50"
                border="2px solid"
                borderColor="bauhaus.border"
              >
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="widest"
                  color="gray.500"
                  mb={1}
                >
                  Net APY (7d)
                </Text>
                <Text fontWeight="black" fontSize="3xl" lineHeight="1" color="bauhaus.black" mb={3}>
                  {netApy7d !== null ? `${netApy7d.toFixed(2)}%` : "—"}
                </Text>
                <Flex gap={2}>
                  <HStack spacing={1}>
                    <Text fontSize="xs" fontWeight="700" color="gray.400" textTransform="uppercase">
                      WCHAN
                    </Text>
                    <Text fontSize="xs" fontWeight="black" color="bauhaus.blue">
                      {apy7d ? `${apy7d.wchanAPY.toFixed(2)}%` : "—"}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" fontWeight="900" color="gray.500">+</Text>
                  <HStack spacing={1}>
                    <Text fontSize="xs" fontWeight="700" color="gray.400" textTransform="uppercase">
                      WETH
                    </Text>
                    <Text fontSize="xs" fontWeight="black" color="bauhaus.red">
                      {wethApy7d !== null ? `${wethApy7d.toFixed(2)}%` : "—"}
                    </Text>
                  </HStack>
                </Flex>
              </Box>

              {/* 30d Column */}
              <Box
                flex={1}
                p={4}
                bg="gray.50"
                border="2px solid"
                borderColor="bauhaus.border"
              >
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="widest"
                  color="gray.500"
                  mb={1}
                >
                  Net APY (30d)
                </Text>
                <Text fontWeight="black" fontSize="3xl" lineHeight="1" color="bauhaus.black" mb={3}>
                  {netApy30d !== null ? `${netApy30d.toFixed(2)}%` : "—"}
                </Text>
                <Flex gap={2}>
                  <HStack spacing={1}>
                    <Text fontSize="xs" fontWeight="700" color="gray.400" textTransform="uppercase">
                      WCHAN
                    </Text>
                    <Text fontSize="xs" fontWeight="black" color="bauhaus.blue">
                      {apy30d ? `${apy30d.wchanAPY.toFixed(2)}%` : "—"}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" fontWeight="900" color="gray.500">+</Text>
                  <HStack spacing={1}>
                    <Text fontSize="xs" fontWeight="700" color="gray.400" textTransform="uppercase">
                      WETH
                    </Text>
                    <Text fontSize="xs" fontWeight="black" color="bauhaus.red">
                      {wethApy30d !== null ? `${wethApy30d.toFixed(2)}%` : "—"}
                    </Text>
                  </HStack>
                </Flex>
              </Box>

              {/* Share Price */}
              <Box>
                <Box
                  p={4}
                  bg="gray.50"
                  border="2px solid"
                  borderColor="bauhaus.border"
                  h="full"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="widest"
                    color="gray.500"
                    mb={1}
                  >
                    Share Price
                  </Text>
                  <Text fontWeight="black" fontSize="3xl" lineHeight="1" color="bauhaus.black">
                    {stats ? fmtSharePrice(stats.currentSharePrice) : "—"}
                  </Text>
                </Box>
              </Box>
            </Flex>

            {/* Detail rows */}
            <Flex gap={3} direction={{ base: "column", md: "row" }}>
              <Box flex={1}>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">
                    Total WCHAN Donated
                  </Text>
                  <Text fontSize="xs" fontWeight="900">
                    {stats ? fmtWei(stats.totalWchanDonated) : "—"}
                  </Text>
                </HStack>
                <HStack justify="space-between" mt={1}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">
                    Total WETH Distributed
                  </Text>
                  <Text fontSize="xs" fontWeight="900">
                    {stats ? fmtWei(stats.totalWethDistributed) : "—"}
                  </Text>
                </HStack>
              </Box>
              <Box flex={1}>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">
                    WETH (7d window)
                  </Text>
                  <Text fontSize="xs" fontWeight="900">
                    {apy7d ? fmtWei(apy7d.wethDistributed) : "—"}
                  </Text>
                </HStack>
                <HStack justify="space-between" mt={1}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">
                    Events Indexed
                  </Text>
                  <Text fontSize="xs" fontWeight="900">
                    {stats
                      ? `${stats.donateEvents} donations · ${stats.donateRewardEvents} rewards · ${stats.penaltyEvents} penalties`
                      : "—"}
                  </Text>
                </HStack>
              </Box>
            </Flex>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
