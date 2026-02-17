"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Skeleton,
  Image,
  Flex,
  Link,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { Navigation } from "../components/Navigation";
import { TokenBanner } from "../components/TokenBanner";
import { useVaultData } from "../contexts/VaultDataContext";
import { useTokenData } from "../contexts/TokenDataContext";
import { erc20Abi, vaultAbi } from "./abi";
import {
  STAKE_CHAIN_ID,
  BNKRW_TOKEN_ADDRESS,
  SBNKRW_VAULT_ADDRESS,
} from "./constants";

const MotionBox = motion(Box);

const VAULT_ADDR = SBNKRW_VAULT_ADDRESS as `0x${string}`;
const TOKEN_ADDR = BNKRW_TOKEN_ADDRESS as `0x${string}`;

type TabType = "deposit" | "withdraw";

function formatBalance(raw: bigint | undefined, decimals: number = 18): string {
  if (!raw) return "0";
  const formatted = formatUnits(raw, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.01) return "<0.01";
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatApr(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function StakePage() {
  const [activeTab, setActiveTab] = useState<TabType>("deposit");
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });
  const toast = useToast();

  // Wallet
  const { address, isConnected: isWalletConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isWalletConnected && chainId !== STAKE_CHAIN_ID;

  // Vault data from Wasabi API
  const { vaultData, isLoading: isVaultLoading, refetchVaultData } = useVaultData();

  // Token price (mcap / total supply)
  const { tokenData } = useTokenData();
  const TOTAL_SUPPLY = 100_000_000_000;
  const tokenPrice = tokenData?.marketCapRaw ? tokenData.marketCapRaw / TOTAL_SUPPLY : 0;

  // BNKRW balance
  const {
    data: bnkrwBalance,
    refetch: refetchBnkrw,
  } = useReadContract({
    address: TOKEN_ADDR,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: STAKE_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 2000 },
  });

  // sBNKRW (staked) balance
  const {
    data: stakedBalance,
    refetch: refetchStaked,
  } = useReadContract({
    address: VAULT_ADDR,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: STAKE_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 2000 },
  });

  // BNKRW allowance for vault
  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: TOKEN_ADDR,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, VAULT_ADDR] : undefined,
    chainId: STAKE_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 2000 },
  });

  // Preview deposit (BNKRW -> sBNKRW)
  const parsedAmount =
    amount && parseFloat(amount) > 0
      ? parseUnits(amount, 18)
      : undefined;

  const { data: previewShares } = useReadContract({
    address: VAULT_ADDR,
    abi: vaultAbi,
    functionName: "previewDeposit",
    args: parsedAmount ? [parsedAmount] : undefined,
    chainId: STAKE_CHAIN_ID,
    query: { enabled: activeTab === "deposit" && !!parsedAmount },
  });

  // Preview redeem (sBNKRW -> BNKRW)
  const { data: previewAssets } = useReadContract({
    address: VAULT_ADDR,
    abi: vaultAbi,
    functionName: "previewRedeem",
    args: parsedAmount ? [parsedAmount] : undefined,
    chainId: STAKE_CHAIN_ID,
    query: { enabled: activeTab === "withdraw" && !!parsedAmount },
  });

  // Write contracts
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositTxHash,
    isPending: isDepositing,
    reset: resetDeposit,
  } = useWriteContract();

  const {
    writeContract: writeRedeem,
    data: redeemTxHash,
    isPending: isRedeeming,
    reset: resetRedeem,
  } = useWriteContract();

  // Wait for tx receipts
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  const { isLoading: isRedeemConfirming, isSuccess: isRedeemConfirmed } =
    useWaitForTransactionReceipt({ hash: redeemTxHash });

  // Derived state
  const currentBalance =
    activeTab === "deposit" ? bnkrwBalance : stakedBalance;
  const currentSymbol = activeTab === "deposit" ? "BNKRW" : "sBNKRW";

  const needsApproval =
    activeTab === "deposit" &&
    parsedAmount !== undefined &&
    allowance !== undefined &&
    (allowance as bigint) < parsedAmount;

  const hasInsufficientBalance =
    parsedAmount !== undefined &&
    currentBalance !== undefined &&
    parsedAmount > (currentBalance as bigint);

  const isBusy =
    isApproving ||
    isApproveConfirming ||
    isDepositing ||
    isDepositConfirming ||
    isRedeeming ||
    isRedeemConfirming;

  // After approve confirms, refetch allowance then reset
  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance().then(() => {
        toast({
          title: "Approval confirmed",
          description: "You can now deposit your BNKRW.",
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "bottom-right",
        });
        resetApprove();
      });
    }
  }, [isApproveConfirmed, refetchAllowance, toast, resetApprove]);

  // After deposit confirms, refetch balances and reset
  useEffect(() => {
    if (isDepositConfirmed && depositTxHash) {
      refetchBnkrw();
      refetchStaked();
      refetchAllowance();
      refetchVaultData();
      setAmount("");
      const txUrl = `https://basescan.org/tx/${depositTxHash}`;
      toast({
        title: "Deposit successful",
        description: (
          <>
            Your BNKRW has been staked.{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              View on BaseScan
            </a>
          </>
        ),
        status: "success",
        duration: 10000,
        isClosable: true,
        position: "bottom-right",
      });
      resetDeposit();
    }
  }, [isDepositConfirmed, depositTxHash, refetchBnkrw, refetchStaked, refetchAllowance, refetchVaultData, toast, resetDeposit]);

  // After redeem confirms, refetch balances and reset
  useEffect(() => {
    if (isRedeemConfirmed && redeemTxHash) {
      refetchBnkrw();
      refetchStaked();
      refetchVaultData();
      setAmount("");
      const txUrl = `https://basescan.org/tx/${redeemTxHash}`;
      toast({
        title: "Withdrawal successful",
        description: (
          <>
            Your BNKRW has been unstaked.{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              View on BaseScan
            </a>
          </>
        ),
        status: "success",
        duration: 10000,
        isClosable: true,
        position: "bottom-right",
      });
      resetRedeem();
    }
  }, [isRedeemConfirmed, redeemTxHash, refetchBnkrw, refetchStaked, refetchVaultData, toast, resetRedeem]);

  const handleAmountChange = (val: string) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
      if (val === "" || parseFloat(val) === 0 || !currentBalance || (currentBalance as bigint) === 0n) {
        setSliderValue(0);
      } else {
        try {
          const parsed = parseUnits(val, 18);
          const bal = currentBalance as bigint;
          const pct = Number((parsed * 100n) / bal);
          setSliderValue(Math.min(pct, 100));
        } catch {
          setSliderValue(0);
        }
      }
    }
  };

  const handleApprove = useCallback(() => {
    writeApprove(
      {
        address: TOKEN_ADDR,
        abi: erc20Abi,
        functionName: "approve",
        args: [VAULT_ADDR, parsedAmount!],
        chainId: STAKE_CHAIN_ID,
      },
      {
        onError: (err) => {
          toast({
            title: "Approval failed",
            description: err.message.split("\n")[0],
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom-right",
          });
        },
      }
    );
  }, [writeApprove, parsedAmount, toast]);

  const handleDeposit = useCallback(() => {
    if (!parsedAmount || !address) return;
    writeDeposit(
      {
        address: VAULT_ADDR,
        abi: vaultAbi,
        functionName: "deposit",
        args: [parsedAmount, address],
        chainId: STAKE_CHAIN_ID,
      },
      {
        onError: (err) => {
          toast({
            title: "Deposit failed",
            description: err.message.split("\n")[0],
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom-right",
          });
        },
      }
    );
  }, [parsedAmount, address, writeDeposit, toast]);

  const handleRedeem = useCallback(() => {
    if (!parsedAmount || !address) return;
    writeRedeem(
      {
        address: VAULT_ADDR,
        abi: vaultAbi,
        functionName: "redeem",
        args: [parsedAmount, address, address],
        chainId: STAKE_CHAIN_ID,
      },
      {
        onError: (err) => {
          toast({
            title: "Withdrawal failed",
            description: err.message.split("\n")[0],
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom-right",
          });
        },
      }
    );
  }, [parsedAmount, address, writeRedeem, toast]);

  const handleAction = () => {
    if (activeTab === "deposit") {
      if (needsApproval) {
        handleApprove();
      } else {
        handleDeposit();
      }
    } else {
      handleRedeem();
    }
  };

  const getButtonLabel = (): string => {
    if (activeTab === "deposit") {
      if (isApproving || isApproveConfirming) return "Approving...";
      if (isDepositing || isDepositConfirming) return "Depositing...";
      if (needsApproval) return "Approve BNKRW";
      return "Deposit";
    }
    if (isRedeeming || isRedeemConfirming) return "Withdrawing...";
    return "Withdraw";
  };

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />
      <TokenBanner />

      <Container maxW="7xl" pt={10} pb={40}>
        <VStack spacing={6} align="stretch">
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
                  bg="bauhaus.blue"
                  border="3px solid"
                  borderColor="bauhaus.black"
                  borderRadius="full"
                />
                <Text
                  fontSize={{ base: "2xl", md: "3xl" }}
                  fontWeight="900"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  BNKRW Staking
                </Text>
                <Box
                  w="16px"
                  h="16px"
                  bg="bauhaus.yellow"
                  border="3px solid"
                  borderColor="bauhaus.black"
                  transform="rotate(45deg)"
                />
              </HStack>
            </MotionBox>

            <Text fontSize="md" color="gray.600" maxW="500px" fontWeight="500">
              Stake your{" "}
              <Text as="span" fontWeight="800">
                BNKRW
              </Text>{" "}
              tokens to earn yield.
            </Text>
            <HStack spacing={2} justify="center">
              <Link
                href="https://app.wasabi.xyz/earn?vault=sBNKRW&network=base"
                isExternal
                bg="bauhaus.blue"
                px={3}
                py={1}
                display="inline-flex"
                alignItems="center"
                gap={1}
                _hover={{ opacity: 0.9, textDecoration: "none" }}
              >
                <Text fontSize="sm" color="white" fontWeight="600">
                  Powered by Wasabi
                </Text>
                <ExternalLink size={12} color="white" />
              </Link>
              <Link
                href={`https://basescan.org/address/${SBNKRW_VAULT_ADDRESS}`}
                isExternal
                display="inline-flex"
                alignItems="center"
                gap={1}
                fontSize="xs"
                fontWeight="700"
                color="gray.500"
                _hover={{ color: "bauhaus.red" }}
              >
                Vault
                <ExternalLink size={12} />
              </Link>
            </HStack>
          </VStack>

          {/* Connect Button */}
          <HStack justify="flex-end" maxW="lg" mx="auto" w="full">
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
          </HStack>

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
                onClick={() => switchChain({ chainId: STAKE_CHAIN_ID })}
                leftIcon={
                  <Image src="/images/base.svg" alt="Base" w="18px" h="18px" />
                }
              >
                Switch to Base
              </Button>
            </HStack>
          )}

          {/* Staking Card */}
          <Box maxW="lg" mx="auto" w="full">
            {/* Stats Row */}
            {!isVaultLoading && vaultData && (
              <Flex gap={3} mb={4}>
                {vaultData.apr > 0 && (
                  <Box
                    bg="white"
                    border="3px solid"
                    borderColor="bauhaus.black"
                    boxShadow="4px 4px 0px 0px #121212"
                    px={4}
                    py={3}
                    textAlign="center"
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="800"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      color="gray.500"
                    >
                      APR
                    </Text>
                    <Text
                      fontSize="xl"
                      fontWeight="900"
                      color="bauhaus.red"
                    >
                      {formatApr(vaultData.apr)}
                    </Text>
                  </Box>
                )}
                <Box
                  flex={1}
                  bg="bauhaus.yellow"
                  border="3px solid"
                  borderColor="bauhaus.black"
                  boxShadow="4px 4px 0px 0px #121212"
                  px={4}
                  py={3}
                  textAlign="center"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="800"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    color="bauhaus.black"
                  >
                    TVL
                  </Text>
                  <Text
                    fontSize="xl"
                    fontWeight="900"
                    color="bauhaus.black"
                  >
                    {formatUsd(vaultData.tvlUsd)}
                  </Text>
                </Box>
                {vaultData.utilizationRate > 0 && (
                  <Box
                    bg="white"
                    border="3px solid"
                    borderColor="bauhaus.black"
                    boxShadow="4px 4px 0px 0px #121212"
                    px={4}
                    py={3}
                    textAlign="center"
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="800"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      color="gray.500"
                    >
                      Utilization
                    </Text>
                    <Text
                      fontSize="xl"
                      fontWeight="900"
                      color="bauhaus.black"
                    >
                      {(vaultData.utilizationRate * 100).toFixed(1)}%
                    </Text>
                  </Box>
                )}
              </Flex>
            )}

            <Box
              bg="white"
              border="4px solid"
              borderColor="bauhaus.black"
              boxShadow="8px 8px 0px 0px #121212"
              position="relative"
              overflow="hidden"
            >
              {/* Geometric decorator */}
              <Box
                position="absolute"
                top={-6}
                right={-6}
                w={16}
                h={16}
                bg="bauhaus.yellow"
                opacity={0.15}
                borderRadius="full"
              />
              <Box
                position="absolute"
                bottom={-4}
                left={-4}
                w={12}
                h={12}
                bg="bauhaus.red"
                opacity={0.1}
                transform="rotate(45deg)"
              />

              {/* Tabs */}
              <Flex borderBottom="4px solid" borderColor="bauhaus.black">
                <Box
                  as="button"
                  flex={1}
                  py={4}
                  bg={activeTab === "deposit" ? "bauhaus.blue" : "white"}
                  color={activeTab === "deposit" ? "white" : "bauhaus.black"}
                  fontWeight="900"
                  fontSize="sm"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  borderRight="2px solid"
                  borderColor="bauhaus.black"
                  transition="all 0.15s ease-out"
                  _hover={{
                    bg:
                      activeTab === "deposit" ? "bauhaus.blue" : "gray.50",
                  }}
                  onClick={() => {
                    setActiveTab("deposit");
                    setAmount("");
                    setSliderValue(0);
                  }}
                >
                  Deposit
                </Box>
                <Box
                  as="button"
                  flex={1}
                  py={4}
                  bg={activeTab === "withdraw" ? "bauhaus.blue" : "white"}
                  color={activeTab === "withdraw" ? "white" : "bauhaus.black"}
                  fontWeight="900"
                  fontSize="sm"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  borderLeft="2px solid"
                  borderColor="bauhaus.black"
                  transition="all 0.15s ease-out"
                  _hover={{
                    bg:
                      activeTab === "withdraw" ? "bauhaus.blue" : "gray.50",
                  }}
                  onClick={() => {
                    setActiveTab("withdraw");
                    setAmount("");
                    setSliderValue(0);
                  }}
                >
                  Withdraw
                </Box>
              </Flex>

              {/* Content */}
              <VStack spacing={5} p={6} position="relative" zIndex={1}>
                {/* Balance display */}
                <Flex justify="space-between" w="full" align="center">
                  <Text
                    fontSize="xs"
                    fontWeight="800"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    color="gray.500"
                  >
                    {activeTab === "deposit"
                      ? "Deposit BNKRW"
                      : "Withdraw sBNKRW"}
                  </Text>
                  {isWalletConnected && (
                    <HStack spacing={1}>
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="gray.500"
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        Balance:
                      </Text>
                      <Text
                        fontSize="xs"
                        fontWeight="900"
                        color="bauhaus.black"
                      >
                        {formatBalance(currentBalance as bigint | undefined)}{" "}
                        {currentSymbol}
                      </Text>
                    </HStack>
                  )}
                </Flex>

                {/* Input */}
                <Box w="full">
                  <Flex
                    border="3px solid"
                    borderColor={hasInsufficientBalance ? "red.400" : "bauhaus.black"}
                    align="center"
                    px={4}
                    h="60px"
                  >
                    <Input
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.0"
                      border="none"
                      borderRadius={0}
                      fontWeight="900"
                      fontSize="xl"
                      h="full"
                      p={0}
                      flex={1}
                      _focus={{ boxShadow: "none" }}
                      isDisabled={isBusy}
                    />
                    <HStack spacing={3} flexShrink={0} ml={3}>
                      {amount && parseFloat(amount) > 0 && tokenPrice > 0 && (
                        <Text
                          fontSize="xs"
                          fontWeight="700"
                          color="gray.400"
                          whiteSpace="nowrap"
                        >
                          ≈ {formatUsd(parseFloat(amount) * tokenPrice)}
                        </Text>
                      )}
                      <Text
                        fontSize="sm"
                        fontWeight="900"
                        color="gray.400"
                        textTransform="uppercase"
                      >
                        {currentSymbol}
                      </Text>
                    </HStack>
                  </Flex>

                  {/* Percentage slider */}
                  {isWalletConnected && currentBalance !== undefined && (currentBalance as bigint) > 0n && (
                    <Box px={2} pt={2} pb={6}>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={sliderValue}
                        onChange={(val) => {
                          const SNAP_THRESHOLD = 3;
                          const snaps = [0, 25, 50, 75, 100];
                          const nearest = snaps.find((s) => Math.abs(val - s) <= SNAP_THRESHOLD);
                          const snapped = nearest !== undefined ? nearest : val;
                          setSliderValue(snapped);
                          if (snapped === 0) {
                            setAmount("");
                          } else {
                            const bal = currentBalance as bigint;
                            const pctAmount = (bal * BigInt(snapped)) / 100n;
                            setAmount(formatUnits(pctAmount, 18));
                          }
                        }}
                      >
                        {[0, 25, 50, 75, 100].map((pct) => (
                          <SliderMark
                            key={pct}
                            value={pct}
                            mt={3}
                            fontSize="xs"
                            fontWeight="800"
                            color={sliderValue >= pct ? "bauhaus.blue" : "gray.400"}
                            whiteSpace="nowrap"
                            transform="translateX(-50%)"
                          >
                            {pct}%
                          </SliderMark>
                        ))}
                        <SliderTrack
                          bg="gray.200"
                          h="6px"
                          borderRadius={0}
                        >
                          <SliderFilledTrack bg="bauhaus.blue" />
                        </SliderTrack>
                        <SliderThumb
                          boxSize={5}
                          bg="bauhaus.blue"
                          border="3px solid"
                          borderColor="bauhaus.black"
                          borderRadius={0}
                          _focus={{ boxShadow: "none" }}
                        />
                      </Slider>
                    </Box>
                  )}
                </Box>

                {/* Insufficient balance warning */}
                {hasInsufficientBalance && (
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="red.500"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    alignSelf="flex-start"
                  >
                    Insufficient {currentSymbol} balance
                  </Text>
                )}

                {/* Preview info row */}
                {activeTab === "deposit" && parsedAmount && previewShares !== undefined && (
                  <Flex
                    w="full"
                    justify="space-between"
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    px={4}
                    py={3}
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      You receive
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="900"
                      color="bauhaus.black"
                    >
                      {formatBalance(previewShares as bigint)} sBNKRW
                    </Text>
                  </Flex>
                )}

                {activeTab === "withdraw" && parsedAmount && previewAssets !== undefined && (
                  <Flex
                    w="full"
                    justify="space-between"
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    px={4}
                    py={3}
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      You receive
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="900"
                      color="bauhaus.black"
                    >
                      {formatBalance(previewAssets as bigint)} BNKRW
                    </Text>
                  </Flex>
                )}

                {/* Tx status indicator */}
                {(approveTxHash || depositTxHash || redeemTxHash) && (
                  <HStack
                    w="full"
                    justify="center"
                    spacing={2}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    px={4}
                    py={2}
                  >
                    {(isApproveConfirming || isDepositConfirming || isRedeemConfirming) && (
                      <>
                        <Spinner size="xs" color="bauhaus.blue" />
                        <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">
                          Confirming...
                        </Text>
                      </>
                    )}
                    <Link
                      href={`https://basescan.org/tx/${approveTxHash || depositTxHash || redeemTxHash}`}
                      isExternal
                      fontSize="xs"
                      fontWeight="700"
                      color="bauhaus.blue"
                      textTransform="uppercase"
                      display="inline-flex"
                      alignItems="center"
                      gap={1}
                    >
                      View on BaseScan
                      <ExternalLink size={10} />
                    </Link>
                  </HStack>
                )}

                {/* Action Button */}
                {!isWalletConnected ? (
                  <Box
                    w="full"
                    sx={{
                      "& button": {
                        w: "full",
                        borderRadius: "0 !important",
                        fontWeight: "bold !important",
                        textTransform: "uppercase",
                        fontFamily: "'Outfit', sans-serif !important",
                        h: "52px",
                        fontSize: "md !important",
                      },
                    }}
                  >
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <Button
                          w="full"
                          variant="primary"
                          size="lg"
                          h="52px"
                          onClick={openConnectModal}
                        >
                          Connect Wallet
                        </Button>
                      )}
                    </ConnectButton.Custom>
                  </Box>
                ) : isWrongChain ? (
                  <Button
                    w="full"
                    variant="secondary"
                    size="lg"
                    h="52px"
                    onClick={() => switchChain({ chainId: STAKE_CHAIN_ID })}
                    leftIcon={
                      <Image
                        src="/images/base.svg"
                        alt="Base"
                        w="18px"
                        h="18px"
                      />
                    }
                  >
                    Switch to Base
                  </Button>
                ) : (
                  <Button
                    w="full"
                    variant={
                      activeTab === "deposit"
                        ? needsApproval
                          ? "yellow"
                          : "secondary"
                        : "primary"
                    }
                    size="lg"
                    h="52px"
                    isDisabled={
                      !amount ||
                      parseFloat(amount) <= 0 ||
                      hasInsufficientBalance ||
                      isBusy
                    }
                    isLoading={isBusy}
                    loadingText={getButtonLabel()}
                    onClick={handleAction}
                  >
                    {getButtonLabel()}
                  </Button>
                )}
              </VStack>
            </Box>

            {/* TODO: Vault details section
            ...
            */}
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
