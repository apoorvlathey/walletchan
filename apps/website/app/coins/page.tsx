"use client";

import { useRef, useEffect, useState } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  Skeleton,
  Spinner,
  IconButton,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { LayoutGrid, List } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { TokenBanner } from "../components/TokenBanner";
import { CoinCard } from "./components/CoinCard";
import { CoinListItem } from "./components/CoinListItem";
import { useCoinsStream } from "./hooks/useCoinsStream";

const MotionBox = motion(Box);

function LiveIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <HStack spacing={2}>
      <Box
        w="10px"
        h="10px"
        borderRadius="full"
        bg={isConnected ? "#22c55e" : "gray.400"}
        boxShadow={isConnected ? "0 0 8px rgba(34, 197, 94, 0.6)" : "none"}
      />
      <Text
        fontSize="xs"
        fontWeight="800"
        textTransform="uppercase"
        letterSpacing="wider"
        color={isConnected ? "#22c55e" : "gray.400"}
      >
        {isConnected ? "Live" : "Connecting..."}
      </Text>
    </HStack>
  );
}

function CoinCardAnimated({
  coin,
  index,
  isNew,
}: {
  coin: { id: string; coinAddress: string; name: string; symbol: string; tokenURI: string; tweetUrl: string | null; creatorAddress: string; blockNumber: string; timestamp: string; transactionHash: string };
  index: number;
  isNew: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      h="full"
    >
      <CoinCard coin={coin} index={index} isNew={isNew} />
    </MotionBox>
  );
}

function LoadingSkeleton() {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Box
          key={i}
          bg="white"
          border="4px solid"
          borderColor="bauhaus.black"
          boxShadow="8px 8px 0px 0px #121212"
          p={6}
        >
          <VStack align="stretch" spacing={3}>
            <HStack spacing={3}>
              <Skeleton w="40px" h="40px" />
              <VStack align="flex-start" spacing={1} flex={1}>
                <Skeleton h="20px" w="60px" />
                <Skeleton h="14px" w="100px" />
              </VStack>
            </HStack>
            <Skeleton h="14px" w="full" />
            <Skeleton h="14px" w="80%" />
          </VStack>
        </Box>
      ))}
    </SimpleGrid>
  );
}

export default function CoinsPage() {
  const { coins, totalCoins, isConnected, isLoading, isLoadingMore, hasMore, loadMore } = useCoinsStream();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

  // Track newly arrived coin IDs (via SSE) for highlight animation
  const [newCoinIds, setNewCoinIds] = useState<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!initialLoadDoneRef.current) {
      // Mark initial load as done after first render
      initialLoadDoneRef.current = true;
      return;
    }

    // Any new coins added after initial load get highlighted
    if (coins.length > 0) {
      const latestId = coins[0].id;
      setNewCoinIds((prev) => {
        if (prev.has(latestId)) return prev;
        const next = new Set(prev);
        next.add(latestId);
        // Remove highlight after animation completes (2.5s)
        setTimeout(() => {
          setNewCoinIds((p) => {
            const updated = new Set(p);
            updated.delete(latestId);
            return updated;
          });
        }, 2500);
        return next;
      });
    }
  }, [coins, isLoading]);

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />
      <TokenBanner />

      <Container maxW="7xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <VStack spacing={3} textAlign="center" ref={headingRef}>
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <HStack spacing={3} justify="center">
                <Box
                  w="16px"
                  h="16px"
                  bg="bauhaus.yellow"
                  border="3px solid"
                  borderColor="bauhaus.black"
                />
                <Text
                  fontSize={{ base: "2xl", md: "3xl" }}
                  fontWeight="900"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Coin Launches
                </Text>
                <Box
                  w="16px"
                  h="16px"
                  bg="bauhaus.red"
                  border="3px solid"
                  borderColor="bauhaus.black"
                  borderRadius="full"
                />
              </HStack>
            </MotionBox>

            <Text
              fontSize="md"
              color="gray.600"
              maxW="500px"
              fontWeight="500"
            >
              Real-time coin launches from the Bankr ecosystem.
            </Text>
          </VStack>

          {/* Stats bar */}
          <Box position="relative">
            <HStack justify="center" spacing={6}>
              <LiveIndicator isConnected={isConnected} />
              {totalCoins > 0 && (
                <Box
                  bg="bauhaus.blue"
                  px={3}
                  py={1}
                  border="2px solid"
                  borderColor="bauhaus.black"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="800"
                    color="white"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    {totalCoins.toLocaleString()} coins
                  </Text>
                </Box>
              )}
            </HStack>
            <HStack spacing={0} position="absolute" right={0} top="50%" transform="translateY(-50%)">
              <IconButton
                aria-label="Grid view"
                icon={<LayoutGrid size={16} />}
                size="sm"
                border="2px solid"
                borderColor="bauhaus.black"
                borderRadius="0"
                bg={viewMode === "grid" ? "bauhaus.blue" : "white"}
                color={viewMode === "grid" ? "white" : "bauhaus.black"}
                _hover={{
                  bg: viewMode === "grid" ? "bauhaus.blue" : "gray.100",
                }}
                onClick={() => setViewMode("grid")}
              />
              <IconButton
                aria-label="List view"
                icon={<List size={16} />}
                size="sm"
                border="2px solid"
                borderColor="bauhaus.black"
                borderLeft="0"
                borderRadius="0"
                bg={viewMode === "list" ? "bauhaus.blue" : "white"}
                color={viewMode === "list" ? "white" : "bauhaus.black"}
                _hover={{
                  bg: viewMode === "list" ? "bauhaus.blue" : "gray.100",
                }}
                onClick={() => setViewMode("list")}
              />
            </HStack>
          </Box>

          {/* Content */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : coins.length > 0 ? (
            <>
              {viewMode === "grid" ? (
                <SimpleGrid
                  columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
                  spacing={4}
                >
                  {coins.map((coin, index) => (
                    <CoinCardAnimated
                      key={coin.id}
                      coin={coin}
                      index={index}
                      isNew={newCoinIds.has(coin.id)}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <VStack spacing={3} align="stretch" maxW="3xl" mx="auto" w="full">
                  {coins.map((coin, index) => (
                    <MotionBox
                      key={coin.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                    >
                      <CoinListItem
                        coin={coin}
                        isNew={newCoinIds.has(coin.id)}
                      />
                    </MotionBox>
                  ))}
                </VStack>
              )}

              {/* Infinite scroll sentinel */}
              <Box ref={sentinelRef} h="1px" />

              {isLoadingMore && (
                <HStack justify="center" py={6}>
                  <Spinner size="md" color="bauhaus.blue" thickness="3px" />
                  <Text fontSize="sm" fontWeight="600" color="gray.500" textTransform="uppercase">
                    Loading more...
                  </Text>
                </HStack>
              )}
            </>
          ) : (
            <Box textAlign="center" py={12}>
              <Text
                fontWeight="700"
                textTransform="uppercase"
                color="gray.500"
              >
                No coins found
              </Text>
              <Text fontSize="sm" color="gray.400" mt={2}>
                Coins will appear here as they are launched.
              </Text>
            </Box>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
