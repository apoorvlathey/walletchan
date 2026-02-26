"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Skeleton,
  Flex,
  IconButton,
  Button,
  Image,
} from "@chakra-ui/react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { Navigation } from "../components/Navigation";
import { ADDRESSES } from "@/lib/wchan-swap/addresses";

const BASE_CHAIN_ID = 8453;
const HOOK_ADDRESS = ADDRESSES[BASE_CHAIN_ID].hook as `0x${string}`;

const HOOK_ABI = [
  {
    inputs: [],
    name: "pendingFees",
    outputs: [
      { name: "wethAmount", type: "uint256" },
      { name: "wchanAmount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "claimFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ETH_PRICE_POLL_MS = 30_000; // 30s
const FEES_POLL_MS = 5_000; // 5s

function formatEth(wei: bigint | undefined): string {
  if (!wei) return "0";
  const eth = formatUnits(wei, 18);
  const num = parseFloat(eth);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01 && value > 0) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

export default function AdminContent() {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [ethPriceLoading, setEthPriceLoading] = useState(true);

  // Chain detection
  const { isConnected: isWalletConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isWalletConnected && chainId !== BASE_CHAIN_ID;

  // Poll pendingFees from the hook contract
  const { data: pendingFees, isLoading: feesLoading, refetch: refetchFees } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: "pendingFees",
    chainId: BASE_CHAIN_ID,
    query: {
      refetchInterval: FEES_POLL_MS,
    },
  });

  // Fetch ETH price from CoinGecko
  const fetchEthPrice = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await res.json();
      if (data?.ethereum?.usd) {
        setEthPrice(data.ethereum.usd);
      }
    } catch (err) {
      console.error("Failed to fetch ETH price:", err);
    } finally {
      setEthPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, ETH_PRICE_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchEthPrice]);

  // Claim fees
  const { writeContract, data: claimTxHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  // Force refetch after claim confirms (with delay for indexing)
  useEffect(() => {
    if (isClaimConfirmed) {
      const timeout = setTimeout(() => {
        refetchFees();
        fetchEthPrice();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isClaimConfirmed, refetchFees, fetchEthPrice]);

  const handleClaim = () => {
    writeContract({
      address: HOOK_ADDRESS,
      abi: HOOK_ABI,
      functionName: "claimFees",
      chainId: BASE_CHAIN_ID,
    });
  };

  const wethAmount = pendingFees?.[0];
  const ethFloat = wethAmount ? parseFloat(formatUnits(wethAmount, 18)) : 0;
  const usdValue = ethPrice ? ethFloat * ethPrice : null;
  const hasClaimable = wethAmount !== undefined && wethAmount > 0n;

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />

      <Container maxW="4xl" py={12}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="flex-start">
            <Box>
              <Text
                fontWeight="black"
                fontSize="3xl"
                textTransform="uppercase"
                letterSpacing="tight"
              >
                Admin
              </Text>
              <Text fontSize="sm" color="gray.600" mt={1}>
                WCHAN Dev Fee Hook &middot; Base
              </Text>
            </Box>
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
          </Flex>

          {/* Wrong Chain Banner */}
          {isWrongChain && (
            <HStack
              justify="center"
              spacing={3}
              bg="bauhaus.red"
              border={{ base: "2px solid", lg: "4px solid" }}
              borderColor="bauhaus.border"
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
                onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}
                leftIcon={<Image src="/images/base.svg" alt="Base" w="18px" h="18px" />}
              >
                Switch to Base
              </Button>
            </HStack>
          )}

          {/* Pending Fees Card */}
          <Box
            bg="white"
            border={{ base: "2px solid", lg: "4px solid" }}
            borderColor="bauhaus.border"
            boxShadow={{ base: "3px 3px 0px 0px #121212", lg: "8px 8px 0px 0px #121212" }}
            p={8}
          >
            <HStack mb={4}>
              <Text
                fontWeight="bold"
                fontSize="sm"
                textTransform="uppercase"
                letterSpacing="wider"
                color="gray.500"
              >
                Pending ETH Fees
              </Text>
              <IconButton
                aria-label="Refresh fees"
                icon={<RefreshCw size={14} />}
                size="xs"
                variant="ghost"
                color="gray.400"
                _hover={{ color: "bauhaus.black" }}
                onClick={() => {
                  refetchFees();
                  fetchEthPrice();
                }}
              />
            </HStack>

            <Flex justify="space-between" align="center">
              <VStack spacing={4} align="stretch">
                {/* USD Value (primary) */}
                <Flex align="baseline" gap={3}>
                  {feesLoading || ethPriceLoading ? (
                    <Skeleton h="40px" w="200px" />
                  ) : usdValue !== null ? (
                    <Text fontWeight="black" fontSize="4xl" lineHeight="1">
                      {formatUsd(usdValue)}
                    </Text>
                  ) : (
                    <Text fontSize="lg" color="gray.400">
                      USD price unavailable
                    </Text>
                  )}
                </Flex>

                {/* ETH Amount (secondary) */}
                <HStack spacing={2}>
                  {feesLoading ? (
                    <Skeleton h="24px" w="120px" />
                  ) : (
                    <Text fontWeight="bold" fontSize="lg" color="bauhaus.blue">
                      {formatEth(wethAmount)} ETH
                    </Text>
                  )}
                </HStack>

                {/* ETH Price Reference */}
                {ethPrice && (
                  <Text fontSize="xs" color="gray.400">
                    ETH price: ${ethPrice.toLocaleString()} &middot; updates every
                    30s
                  </Text>
                )}
              </VStack>

              {/* Claim Button */}
              <Button
                variant="primary"
                size="md"
                onClick={handleClaim}
                isLoading={isClaiming || isClaimConfirming}
                loadingText={isClaimConfirming ? "Confirming..." : "Claiming..."}
                isDisabled={!isWalletConnected || isWrongChain || !hasClaimable}
              >
                Claim Fees
              </Button>
            </Flex>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
