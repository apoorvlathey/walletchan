"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { useAccount, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { base } from "wagmi/chains";
import { useTokenInfo } from "../hooks/useTokenInfo";
import { useSwapQuote, formatTokenAmount } from "../hooks/useSwapQuote";
import { NATIVE_TOKEN_ADDRESS, DEFAULT_SLIPPAGE_BPS } from "../constants";
import { QuoteDisplay } from "./QuoteDisplay";
import { SwapButton } from "./SwapButton";
import { SlippageSettings } from "./SlippageSettings";

function ArrowDownIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path fill="currentColor" d="M12 4v12.17l-4.59-4.58L6 13l6 6 6-6-1.41-1.41L12 16.17V4z" />
    </Icon>
  );
}

export function SwapCard() {
  const { address, isConnected } = useAccount();

  const [buyTokenAddress, setBuyTokenAddress] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  // Read token from URL on mount (avoids useSearchParams + Suspense flash)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) {
      setBuyTokenAddress(token);
    }
  }, []);

  const updateTokenParam = useCallback((token: string) => {
    const url = new URL(window.location.href);
    if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) {
      url.searchParams.set("token", token);
    } else {
      url.searchParams.delete("token");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  const handleBuyTokenChange = (value: string) => {
    const trimmed = value.trim();
    setBuyTokenAddress(trimmed);
    updateTokenParam(trimmed);
  };

  const sellToken = NATIVE_TOKEN_ADDRESS;

  // Fetch ETH balance on Base, auto-refresh when tx confirms
  const { data: ethBalance, refetch: refetchBalance } = useBalance({
    address,
    chainId: base.id,
    query: { enabled: !!address },
  });

  // Validate buy token address
  const isBuyTokenValid =
    buyTokenAddress.length === 42 &&
    /^0x[a-fA-F0-9]{40}$/.test(buyTokenAddress);

  // Fetch token info
  const { tokenInfo: buyTokenInfo, isLoading: isBuyTokenLoading } =
    useTokenInfo(isBuyTokenValid ? buyTokenAddress : undefined);

  const { tokenInfo: sellTokenInfo } = useTokenInfo(sellToken);

  // Parse amount validity
  const sellAmountValid = useMemo(() => {
    if (!sellAmount) return false;
    const num = parseFloat(sellAmount);
    return !isNaN(num) && num > 0;
  }, [sellAmount]);

  // Fetch price quote (debounced auto-fetch, no periodic refresh)
  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    fetchFirmQuote,
  } = useSwapQuote({
    sellToken,
    buyToken: buyTokenAddress,
    sellAmountEth: sellAmount,
    taker: address,
    slippageBps,
    enabled: isBuyTokenValid && sellAmountValid,
  });

  const formattedBalance = ethBalance
    ? parseFloat(formatEther(ethBalance.value)).toFixed(4)
    : null;

  const handleMaxClick = () => {
    if (ethBalance) {
      // Leave a small amount for gas
      const max = ethBalance.value - BigInt(5e15); // ~0.005 ETH for gas
      if (max > 0n) {
        setSellAmount(parseFloat(formatEther(max)).toString());
      }
    }
  };

  const handleTxConfirmed = (hash: `0x${string}`) => {
    refetchBalance();
  };

  // Output amount display
  const outputAmount =
    quote && buyTokenInfo
      ? formatTokenAmount(quote.buyAmount, buyTokenInfo.decimals)
      : "";

  return (
    <Box
      bg="white"
      border={{ base: "2px solid", lg: "4px solid" }}
      borderColor="bauhaus.border"
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
        bg="bauhaus.blue"
        transform="rotate(45deg)"
      />

      <VStack spacing={6} align="stretch">
        {/* Header row: title + wallet */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading
              size="lg"
              textTransform="uppercase"
              letterSpacing="tight"
              lineHeight="1"
            >
              Swap
            </Heading>
            {buyTokenInfo && (
              <Text
                fontSize="sm"
                fontWeight="black"
                textTransform="uppercase"
              >
                ETH &rarr; {buyTokenInfo.symbol}
              </Text>
            )}
          </VStack>
          <Box
            sx={{
              // Style RainbowKit button to fit Bauhaus
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

        {/* 1. Token address input */}
        <Box>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="widest"
            mb={2}
          >
            Token to Buy
          </Text>
          <HStack
            border="2px solid"
            borderColor="bauhaus.border"
            p={3}
            spacing={3}
          >
            <Input
              placeholder="0x..."
              value={buyTokenAddress}
              onChange={(e) => handleBuyTokenChange(e.target.value)}
              border="none"
              _focus={{ boxShadow: "none" }}
              fontSize="sm"
              fontWeight="bold"
              fontFamily="mono"
              p={0}
              flex={1}
            />
            {isBuyTokenLoading && <Spinner size="sm" />}
            {buyTokenInfo && (
              <Flex
                bg="bauhaus.blue"
                color="white"
                px={3}
                py={1}
                align="center"
                flexShrink={0}
              >
                <Text
                  fontWeight="bold"
                  fontSize="sm"
                  textTransform="uppercase"
                >
                  {buyTokenInfo.symbol}
                </Text>
              </Flex>
            )}
          </HStack>
          {buyTokenInfo && (
            <Text fontSize="xs" color="gray.500" mt={1} fontWeight="medium">
              {buyTokenInfo.name}
            </Text>
          )}
        </Box>

        {/* 2. ETH input → Arrow → Output — single wrapper so arrow sits between */}
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
              {isConnected && formattedBalance && (
                <HStack spacing={1}>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">
                    Balance: {formattedBalance} ETH
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
              borderColor="bauhaus.border"
              p={3}
              spacing={3}
            >
              <Input
                placeholder="0.0"
                value={sellAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setSellAmount(val);
                  }
                }}
                border="none"
                _focus={{ boxShadow: "none" }}
                fontSize="xl"
                fontWeight="black"
                p={0}
                flex={1}
              />
              <Flex
                bg="bauhaus.foreground"
                color="white"
                px={3}
                py={1}
                align="center"
              >
                <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
                  ETH
                </Text>
              </Flex>
            </HStack>
          </Box>

          {/* Arrow — absolutely centered between the two fields */}
          <Flex
            justify="center"
            position="absolute"
            left="0"
            right="0"
            top="50%"
            transform="translateY(-50%)"
            zIndex={2}
            pointerEvents="none"
          >
            <Flex
              w={9}
              h={9}
              bg="bauhaus.blue"
              color="white"
              align="center"
              justify="center"
              border="3px solid white"
            >
              <ArrowDownIcon boxSize={5} />
            </Flex>
          </Flex>

          {/* Spacer between fields */}
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
              borderColor="bauhaus.border"
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
              {buyTokenInfo && (
                <Flex
                  bg="bauhaus.blue"
                  color="white"
                  px={3}
                  py={1}
                  align="center"
                  flexShrink={0}
                >
                  <Text
                    fontWeight="bold"
                    fontSize="sm"
                    textTransform="uppercase"
                  >
                    {buyTokenInfo.symbol}
                  </Text>
                </Flex>
              )}
            </HStack>
          </Box>
        </Box>

        {/* Quote breakdown */}
        {quote && buyTokenInfo && sellTokenInfo && (
          <QuoteDisplay
            quote={quote}
            buyTokenSymbol={buyTokenInfo.symbol}
            buyTokenDecimals={buyTokenInfo.decimals}
            sellTokenSymbol={sellTokenInfo.symbol}
            sellTokenDecimals={sellTokenInfo.decimals}
          />
        )}

        {/* Error display */}
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

        {/* Action button: Get Quote → Swap */}
        <SwapButton
          sellToken={sellToken}
          quote={quote}
          fetchFirmQuote={fetchFirmQuote}
          isQuoteLoading={isQuoteLoading}
          sellAmountValid={sellAmountValid && isBuyTokenValid}
          onTxConfirmed={handleTxConfirmed}
        />
      </VStack>
    </Box>
  );
}
