"use client";

import { useState, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Heading,
  Spinner,
  Flex,
  Icon,
} from "@chakra-ui/react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, erc20Abi } from "viem";
import { base } from "wagmi/chains";
import {
  type SwapDirection,
  type RoutePreference,
  getAddresses,
  isChainLive,
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_PRESETS,
} from "../../../lib/wchan-swap";
import { useSwapQuote } from "../hooks/useSwapQuote";
import { SwapButton } from "./SwapButton";
import { SlippageSettings } from "../../swap/components/SlippageSettings";

const CHAIN_ID = base.id;

function ArrowDownIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12 4v12.17l-4.59-4.58L6 13l6 6 6-6-1.41-1.41L12 16.17V4z"
      />
    </Icon>
  );
}

function SwapArrowIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
      />
      <path
        fill="currentColor"
        d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
        transform="translate(0, 4)"
      />
    </Icon>
  );
}

function formatAmount(value: bigint, decimals: number = 18): string {
  const str = formatEther(value);
  const num = parseFloat(str);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(Math.min(6, decimals));
}

export function SwapCard() {
  const { address, isConnected } = useAccount();
  const [direction, setDirection] = useState<SwapDirection>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [routePreference, setRoutePreference] = useState<RoutePreference>("auto");

  const live = isChainLive(CHAIN_ID);
  const addrs = getAddresses(CHAIN_ID);

  // ETH balance
  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  // WCHAN balance
  const { data: wchanBalance, refetch: refetchWchanBalance } = useReadContract({
    address: addrs.wchan,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  const amountValid = useMemo(() => {
    if (!amount) return false;
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }, [amount]);

  const { quote, isLoading: isQuoteLoading, error: quoteError } = useSwapQuote({
    chainId: CHAIN_ID,
    direction,
    amount,
    enabled: amountValid && live,
    routePreference,
  });

  const toggleDirection = () => {
    setDirection((d) => (d === "buy" ? "sell" : "buy"));
    setAmount("");
  };

  const handleTxConfirmed = () => {
    refetchEthBalance();
    refetchWchanBalance();
  };

  const handleMaxClick = () => {
    if (direction === "buy" && ethBalance) {
      const max = ethBalance.value - BigInt(5e15); // ~0.005 ETH for gas
      if (max > 0n) setAmount(parseFloat(formatEther(max)).toString());
    } else if (direction === "sell" && wchanBalance) {
      if (wchanBalance > 0n) setAmount(formatEther(wchanBalance));
    }
  };

  const sellLabel = direction === "buy" ? "ETH" : "WCHAN";
  const buyLabel = direction === "buy" ? "WCHAN" : "ETH";
  const balance =
    direction === "buy"
      ? ethBalance
        ? parseFloat(formatEther(ethBalance.value)).toFixed(4) + " ETH"
        : null
      : wchanBalance !== undefined
        ? formatAmount(wchanBalance) + " WCHAN"
        : null;

  const insufficientBalance = useMemo(() => {
    if (!amountValid || !isConnected) return false;
    try {
      const parsed = parseFloat(amount);
      if (direction === "buy" && ethBalance) {
        return parsed > parseFloat(formatEther(ethBalance.value));
      }
      if (direction === "sell" && wchanBalance !== undefined) {
        return parsed > parseFloat(formatEther(wchanBalance));
      }
    } catch {
      return false;
    }
    return false;
  }, [amount, amountValid, direction, ethBalance, wchanBalance, isConnected]);

  const outputAmount =
    quote && quote.amountOut > 0n ? formatAmount(quote.amountOut) : "";

  return (
    <Box
      bg="white"
      border={{ base: "2px solid", lg: "4px solid" }}
      borderColor="bauhaus.black"
      boxShadow={{
        base: "4px 4px 0px 0px #121212",
        lg: "8px 8px 0px 0px #121212",
      }}
      p={{ base: 5, md: 8 }}
      position="relative"
      w="full"
      maxW="480px"
    >
      {/* Geometric decorators */}
      <Box
        position="absolute"
        top={3}
        right={3}
        w={3}
        h={3}
        bg="bauhaus.red"
        borderRadius="full"
      />
      <Box
        position="absolute"
        top={3}
        right={9}
        w={3}
        h={3}
        bg="bauhaus.yellow"
        transform="rotate(45deg)"
      />

      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading
              size="lg"
              textTransform="uppercase"
              letterSpacing="tight"
              lineHeight="1"
            >
              {direction === "buy" ? "Buy" : "Sell"} WCHAN
            </Heading>
            <Text
              fontSize="sm"
              fontWeight="black"
              textTransform="uppercase"
            >
              {sellLabel} &rarr; {buyLabel}
            </Text>
          </VStack>
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
              chainStatus="icon"
              showBalance={false}
              accountStatus="address"
            />
          </Box>
        </HStack>

        {/* Route toggle */}
        <HStack spacing={0} w="full">
          {(["auto", "direct", "via-bnkrw"] as const).map((route) => (
            <Box
              key={route}
              as="button"
              flex={1}
              py={1.5}
              bg={routePreference === route ? "bauhaus.black" : "white"}
              color={routePreference === route ? "white" : "bauhaus.black"}
              border="2px solid"
              borderColor="bauhaus.black"
              borderRight={route !== "via-bnkrw" ? "none" : "2px solid"}
              fontWeight="bold"
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="wider"
              cursor="pointer"
              onClick={() => setRoutePreference(route)}
              _hover={{
                bg: routePreference === route ? "bauhaus.black" : "gray.100",
              }}
              transition="all 0.1s"
            >
              {route === "auto"
                ? "Auto"
                : route === "direct"
                  ? "Direct"
                  : "Via BNKRW"}
            </Box>
          ))}
        </HStack>

        {/* Input / Output fields with flip arrow */}
        <Box position="relative">
          {/* You Pay */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                You Pay
              </Text>
              {isConnected && balance && (
                <HStack spacing={1}>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">
                    Balance: {balance}
                  </Text>
                  <Box
                    as="button"
                    fontSize="xs"
                    fontWeight="bold"
                    color="bauhaus.blue"
                    textTransform="uppercase"
                    onClick={handleMaxClick}
                    _hover={{ textDecoration: "underline" }}
                  >
                    Max
                  </Box>
                </HStack>
              )}
            </HStack>
            <HStack
              border="2px solid"
              borderColor="bauhaus.black"
              p={3}
              spacing={3}
            >
              <Input
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*\.?\d*$/.test(val)) setAmount(val);
                }}
                border="none"
                _focus={{ boxShadow: "none" }}
                fontSize="xl"
                fontWeight="black"
                p={0}
                flex={1}
              />
              <Flex
                bg={direction === "buy" ? "gray.700" : "bauhaus.blue"}
                color="white"
                px={3}
                py={1}
                align="center"
              >
                <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
                  {sellLabel}
                </Text>
              </Flex>
            </HStack>
          </Box>

          {/* Flip arrow */}
          <Flex
            justify="center"
            position="absolute"
            left="0"
            right="0"
            top="50%"
            transform="translateY(-50%)"
            zIndex={2}
          >
            <Flex
              as="button"
              w={9}
              h={9}
              bg="bauhaus.blue"
              color="white"
              align="center"
              justify="center"
              border="3px solid white"
              cursor="pointer"
              onClick={toggleDirection}
              _hover={{ opacity: 0.85 }}
              transition="opacity 0.15s"
            >
              <SwapArrowIcon boxSize={5} />
            </Flex>
          </Flex>

          <Box h={4} />

          {/* You Receive */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                You Receive
              </Text>
              <SlippageSettings
                slippageBps={slippageBps}
                onSlippageChange={setSlippageBps}
              />
            </HStack>
            <HStack
              border="2px solid"
              borderColor="bauhaus.black"
              p={3}
              spacing={3}
              bg="gray.50"
            >
              <Input
                placeholder={quote === null && !isQuoteLoading ? "\u2014" : "0.0"}
                value={isQuoteLoading ? "" : outputAmount}
                readOnly
                border="none"
                _focus={{ boxShadow: "none" }}
                fontSize="xl"
                fontWeight="black"
                p={0}
                flex={1}
                cursor="default"
                tabIndex={-1}
              />
              {isQuoteLoading && <Spinner size="sm" />}
              <Flex
                bg={direction === "buy" ? "bauhaus.blue" : "gray.700"}
                color="white"
                px={3}
                py={1}
                align="center"
                flexShrink={0}
              >
                <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
                  {buyLabel}
                </Text>
              </Flex>
            </HStack>
          </Box>
        </Box>

        {/* Route indicator (auto mode) */}
        {routePreference === "auto" && quote && (
          <Text
            fontSize="xs"
            color="gray.500"
            fontWeight="bold"
            textTransform="uppercase"
            textAlign="right"
            mt={-4}
          >
            Route: {quote.route === "direct" ? "Direct" : "Via BNKRW"}
          </Text>
        )}

        {/* Error */}
        {quoteError && (
          <Text
            fontSize="sm"
            color="bauhaus.red"
            fontWeight="bold"
            textAlign="center"
          >
            {quoteError}
          </Text>
        )}

        {/* Not live warning */}
        {!live && (
          <Flex
            bg="bauhaus.yellow"
            border="2px solid"
            borderColor="bauhaus.black"
            p={3}
            justify="center"
          >
            <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
              Coming Soon on this chain
            </Text>
          </Flex>
        )}

        {/* Swap button */}
        <SwapButton
          direction={direction}
          quote={quote}
          chainId={CHAIN_ID}
          slippageBps={slippageBps}
          isQuoteLoading={isQuoteLoading}
          inputValid={amountValid}
          insufficientBalance={insufficientBalance}
          onTxConfirmed={handleTxConfirmed}
        />
      </VStack>
    </Box>
  );
}
