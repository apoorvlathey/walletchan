"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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
  Input,
  InputGroup,
  InputRightElement,
  useDisclosure,
  Button,
  Image,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { LayoutGrid, List, Zap, AlertTriangle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { readContracts } from "wagmi/actions";
import { base } from "wagmi/chains";
import { config as wagmiConfig } from "../wagmiConfig";
import { Navigation } from "../components/Navigation";
import { TokenBanner } from "../components/TokenBanner";
import { CoinCard } from "./components/CoinCard";
import { CoinListItem } from "./components/CoinListItem";
import { BuyModal, type BuyToken } from "./components/BuyModal";
import { useCoinsStream, type Coin } from "./hooks/useCoinsStream";
// TODO: revisit once we have a GeckoTerminal API key or paid plan to avoid rate limits
// import { usePoolMarketData, type PoolMarketData } from "./hooks/usePoolMarketData";
import type { PoolMarketData } from "./hooks/usePoolMarketData";
import { useInstaBuy } from "./hooks/useInstaBuy";
import { SWAP_CHAIN_ID } from "../swap/constants";
import { INDEXER_API_URL } from "../constants";
import { CoinAbi } from "./abi";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function setBuyParam(address: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("buy", address);
  window.history.replaceState(null, "", url.toString());
}

function clearBuyParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("buy");
  window.history.replaceState(null, "", url.toString());
}

const INSTA_BUY_AMOUNT_KEY = "instaBuyAmount";
const DEFAULT_INSTA_BUY_AMOUNT = "0.01";
const VIEW_MODE_KEY = "coinsViewMode";

const MotionBox = motion(Box);

function LiveIndicator({ isStreamConnected }: { isStreamConnected: boolean }) {
  return (
    <HStack spacing={2}>
      <Box
        w="10px"
        h="10px"
        borderRadius="full"
        bg={isStreamConnected ? "#22c55e" : "gray.400"}
        boxShadow={
          isStreamConnected ? "0 0 8px rgba(34, 197, 94, 0.6)" : "none"
        }
      />
      <Text
        fontSize="xs"
        fontWeight="800"
        textTransform="uppercase"
        letterSpacing="wider"
        color={isStreamConnected ? "#22c55e" : "gray.400"}
      >
        {isStreamConnected ? "Live" : "Connecting..."}
      </Text>
    </HStack>
  );
}

function CoinCardAnimated({
  coin,
  index,
  isNew,
  onBuy,
  onInstaBuy,
  isInstaBuying,
  marketData,
}: {
  coin: Coin;
  index: number;
  isNew: boolean;
  onBuy?: () => void;
  onInstaBuy?: () => void;
  isInstaBuying?: boolean;
  marketData?: PoolMarketData;
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
      <CoinCard
        coin={coin}
        index={index}
        isNew={isNew}
        onBuy={onBuy}
        onInstaBuy={onInstaBuy}
        isInstaBuying={isInstaBuying}
        marketData={marketData}
      />
    </MotionBox>
  );
}

function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <VStack spacing={3} align="stretch" maxW="3xl" mx="auto" w="full">
        {Array.from({ length: 6 }).map((_, i) => (
          <Box
            key={i}
            bg="white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <HStack spacing={4}>
              <Skeleton h="14px" w="50px" />
              <Skeleton h="18px" w="120px" />
              <Skeleton h="14px" w="80px" />
            </HStack>
          </Box>
        ))}
      </VStack>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={4}>
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
  const {
    coins: allCoins,
    totalCoins,
    isConnected: isStreamConnected,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useCoinsStream();
  const coins = allCoins;
  // TODO: revisit once we have a GeckoTerminal API key to avoid rate limits
  const poolMarketData = new Map<string, PoolMarketData>();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedToken, setSelectedToken] = useState<BuyToken | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  // Chain detection
  const { isConnected: isWalletConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isWalletConnected && chainId !== SWAP_CHAIN_ID;

  // Insta Buy
  const { instaBuy, isBuying } = useInstaBuy();
  const [buyingCoinId, setBuyingCoinId] = useState<string | null>(null);
  const [instaBuyAmount, setInstaBuyAmount] = useState(
    DEFAULT_INSTA_BUY_AMOUNT,
  );

  // Load persisted settings from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_MODE_KEY);
    if (savedView === "grid" || savedView === "list") setViewMode(savedView);
    const saved = localStorage.getItem(INSTA_BUY_AMOUNT_KEY);
    if (saved) setInstaBuyAmount(saved);
  }, []);

  const handleInstaBuyAmountChange = useCallback((val: string) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setInstaBuyAmount(val);
      localStorage.setItem(INSTA_BUY_AMOUNT_KEY, val);
    }
  }, []);

  const handleInstaBuy = useCallback(
    (coin: Coin) => {
      setBuyingCoinId(coin.id);
      instaBuy(coin.coinAddress, instaBuyAmount).finally(() =>
        setBuyingCoinId(null),
      );
    },
    [instaBuy, instaBuyAmount],
  );

  const handleBuy = useCallback(
    (coin: Coin) => {
      setSelectedToken({
        address: coin.coinAddress,
        name: coin.name,
        symbol: coin.symbol,
        tokenURI: coin.tokenURI,
      });
      setBuyParam(coin.coinAddress);
      onOpen();
    },
    [onOpen],
  );

  const handleClose = useCallback(() => {
    clearBuyParam();
    onClose();
  }, [onClose]);

  // Auto-open buy modal from URL param (?buy=0x...)
  const buyParamHandledRef = useRef(false);
  useEffect(() => {
    if (buyParamHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const buyAddress = params.get("buy");
    if (!buyAddress || !ADDRESS_RE.test(buyAddress)) {
      if (buyAddress) clearBuyParam(); // invalid address, clean up
      return;
    }

    // 1. Check loaded coins array
    if (!isLoading && coins.length > 0) {
      const match = coins.find(
        (c) => c.coinAddress.toLowerCase() === buyAddress.toLowerCase()
      );
      if (match) {
        buyParamHandledRef.current = true;
        setSelectedToken({
          address: match.coinAddress,
          name: match.name,
          symbol: match.symbol,
          tokenURI: match.tokenURI,
        });
        onOpen();
        return;
      }
    }

    // Wait for initial coins to load before trying remote lookups
    if (isLoading) return;

    buyParamHandledRef.current = true;

    // 2. Try indexer API, then 3. RPC fallback
    (async () => {
      try {
        const res = await fetch(`${INDEXER_API_URL}/coins/${buyAddress}`);
        if (res.ok) {
          const coin: Coin = await res.json();
          setSelectedToken({
            address: coin.coinAddress,
            name: coin.name,
            symbol: coin.symbol,
            tokenURI: coin.tokenURI,
          });
          onOpen();
          return;
        }
      } catch {
        // indexer failed, try RPC
      }

      try {
        const results = await readContracts(wagmiConfig, {
          contracts: [
            { address: buyAddress as `0x${string}`, abi: CoinAbi, functionName: "name", chainId: base.id },
            { address: buyAddress as `0x${string}`, abi: CoinAbi, functionName: "symbol", chainId: base.id },
            { address: buyAddress as `0x${string}`, abi: CoinAbi, functionName: "tokenURI", chainId: base.id },
          ],
        });
        const name = results[0].status === "success" ? (results[0].result as string) : "";
        const symbol = results[1].status === "success" ? (results[1].result as string) : "";
        const tokenURI = results[2].status === "success" ? (results[2].result as string) : "";

        if (name || symbol) {
          setSelectedToken({ address: buyAddress, name, symbol, tokenURI });
          onOpen();
          return;
        }
      } catch {
        // RPC also failed
      }

      // All lookups failed — clear param
      clearBuyParam();
    })();
  }, [isLoading, coins, onOpen]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading
        ) {
          loadMore();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

  // Track newly arrived coin IDs (via SSE) for highlight animation
  const [newCoinIds, setNewCoinIds] = useState<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading) return;

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }

    if (coins.length > 0) {
      const latestId = coins[0].id;
      if (animatedIdsRef.current.has(latestId)) return;
      animatedIdsRef.current.add(latestId);

      setNewCoinIds((prev) => {
        const next = new Set(prev);
        next.add(latestId);
        return next;
      });
      setTimeout(() => {
        setNewCoinIds((p) => {
          const updated = new Set(p);
          updated.delete(latestId);
          return updated;
        });
      }, 2500);
    }
  }, [coins, isLoading]);

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />
      <TokenBanner />

      <Container maxW="7xl" pt={10} pb={4}>
        <VStack spacing={4} align="stretch">
          {/* Header */}
          <VStack spacing={1} textAlign="center" ref={headingRef}>
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

            <Text fontSize="md" color="gray.600" maxW="500px" fontWeight="500">
              Real-time coin launches from the{" "}
              <Text as="span" fontWeight="800">
                Bankr Ecosystem
              </Text>
              .
            </Text>
            <Box bg="bauhaus.yellow" px={3} py={1} display="inline-block">
              <Text fontSize="sm" color="bauhaus.black" fontWeight="600">
                Swap fees on the buys here go into $BNKRW buybacks
              </Text>
            </Box>
          </VStack>

          {/* Stats bar */}
          <Box position="relative" my={2}>
            <HStack justify="center" spacing={6}>
              <LiveIndicator isStreamConnected={isStreamConnected} />
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
            <HStack
              spacing={3}
              position={{ base: "static", md: "absolute" }}
              right={0}
              top={{ md: "50%" }}
              transform={{ md: "translateY(-50%)" }}
              justify="center"
              mt={{ base: 3, md: 0 }}
            >
              <Box
                sx={{
                  "& button": {
                    borderRadius: "0 !important",
                    fontWeight: "bold !important",
                    textTransform: "uppercase",
                    fontFamily: "'Outfit', sans-serif !important",
                  },
                }}
              >
                <ConnectButton
                  chainStatus="none"
                  showBalance={false}
                  accountStatus="address"
                />
              </Box>
              <HStack spacing={0}>
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
                  onClick={() => { setViewMode("grid"); localStorage.setItem(VIEW_MODE_KEY, "grid"); }}
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
                  onClick={() => { setViewMode("list"); localStorage.setItem(VIEW_MODE_KEY, "list"); }}
                />
              </HStack>
            </HStack>
          </Box>

          {/* Wrong Chain Banner */}
          {isWrongChain && (
            <HStack
              justify="center"
              spacing={3}
              bg="bauhaus.red"
              border="3px solid"
              borderColor="bauhaus.black"
              px={4}
              py={3}
            >
              <AlertTriangle size={18} color="white" />
              <Text
                fontSize="sm"
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing="wide"
                color="white"
              >
                Wrong Network
              </Text>
              <Button
                size="sm"
                bg="white"
                color="bauhaus.black"
                fontWeight="900"
                textTransform="uppercase"
                letterSpacing="wide"
                borderRadius={0}
                border="2px solid"
                borderColor="bauhaus.black"
                _hover={{ bg: "gray.100" }}
                onClick={() => switchChain({ chainId: SWAP_CHAIN_ID })}
                leftIcon={<Image src="/images/base.svg" alt="Base" w="18px" h="18px" />}
              >
                Switch to Base
              </Button>
            </HStack>
          )}

          {/* Insta Buy Amount */}
          <HStack justify="center" spacing={2} mb={2}>
            <HStack spacing={1}>
              <Zap size={14} fill="#F0C020" color="#F0C020" />
              <Text
                fontSize="xs"
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing="wider"
                color="gray.500"
              >
                Insta Buy
              </Text>
            </HStack>
            <InputGroup size="sm" w="140px">
              <Input
                value={instaBuyAmount}
                onChange={(e) => handleInstaBuyAmountChange(e.target.value)}
                placeholder="0.01"
                border="2px solid"
                borderColor="bauhaus.black"
                borderRadius={0}
                fontWeight="800"
                fontSize="sm"
                textAlign="right"
                pr="42px"
                _focus={{ borderColor: "bauhaus.yellow", boxShadow: "none" }}
              />
              <InputRightElement
                w="38px"
                h="full"
                bg="bauhaus.yellow"
                borderLeft="2px solid"
                borderColor="bauhaus.black"
                pointerEvents="none"
              >
                <Text fontSize="xs" fontWeight="900" color="bauhaus.black">
                  ETH
                </Text>
              </InputRightElement>
            </InputGroup>
          </HStack>

          {/* Content */}
          {isLoading ? (
            <LoadingSkeleton viewMode={viewMode} />
          ) : coins.length > 0 ? (
            <>
              {viewMode === "grid" ? (
                <SimpleGrid
                  columns={{ base: 1, sm: 2, lg: 3, xl: 4 }}
                  spacing={4}
                >
                  {coins.map((coin, index) => (
                    <CoinCardAnimated
                      key={coin.id}
                      coin={coin}
                      index={index}
                      isNew={newCoinIds.has(coin.id)}
                      onBuy={() => handleBuy(coin)}
                      onInstaBuy={() => handleInstaBuy(coin)}
                      isInstaBuying={buyingCoinId === coin.id}
                      marketData={coin.poolId ? poolMarketData.get(coin.poolId.toLowerCase()) : undefined}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <VStack
                  spacing={3}
                  align="stretch"
                  maxW="3xl"
                  mx="auto"
                  w="full"
                >
                  {coins.map((coin, index) => (
                    <MotionBox
                      key={coin.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.03, 0.3),
                      }}
                    >
                      <CoinListItem
                        coin={coin}
                        isNew={newCoinIds.has(coin.id)}
                        onBuy={() => handleBuy(coin)}
                        onInstaBuy={() => handleInstaBuy(coin)}
                        isInstaBuying={buyingCoinId === coin.id}
                        marketData={coin.poolId ? poolMarketData.get(coin.poolId.toLowerCase()) : undefined}
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
                  <Text
                    fontSize="sm"
                    fontWeight="600"
                    color="gray.500"
                    textTransform="uppercase"
                  >
                    Loading more...
                  </Text>
                </HStack>
              )}
            </>
          ) : (
            <Box textAlign="center" py={12}>
              <Text fontWeight="700" textTransform="uppercase" color="gray.500">
                No coins found
              </Text>
              <Text fontSize="sm" color="gray.400" mt={2}>
                Coins will appear here as they are launched.
              </Text>
            </Box>
          )}
        </VStack>
      </Container>

      <BuyModal token={selectedToken} isOpen={isOpen} onClose={handleClose} />
    </Box>
  );
}
