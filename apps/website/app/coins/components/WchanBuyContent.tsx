"use client";

import { useMemo } from "react";
import {
  HStack,
  Text,
  Input,
  Button,
  Box,
  Flex,
  Image,
} from "@chakra-ui/react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther } from "viem";
import { base } from "wagmi/chains";
import { SLIPPAGE_PRESETS } from "../../../lib/wchan-swap";
import { useSwapQuote } from "../../swap-wchan/hooks/useSwapQuote";
import { SwapButton } from "../../swap-wchan/components/SwapButton";
import { SlippageSettings } from "../../swap/components/SlippageSettings";
import { LoadingShapes } from "../../components/ui/LoadingShapes";

const CHAIN_ID = base.id;

function formatAmount(value: bigint): string {
  const str = formatEther(value);
  const num = parseFloat(str);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(Math.min(6, 18));
}

interface WchanBuyContentProps {
  sellAmount: string;
  sellAmountValid: boolean;
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
  buyTokenSymbol: string;
  ethBalanceWei: bigint | undefined;
  onTxConfirmed: () => void;
}

export function WchanBuyContent({
  sellAmount,
  sellAmountValid,
  slippageBps,
  onSlippageChange,
  buyTokenSymbol,
  ethBalanceWei,
  onTxConfirmed,
}: WchanBuyContentProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== CHAIN_ID;

  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useSwapQuote({
    chainId: CHAIN_ID,
    direction: "buy",
    amount: sellAmount,
    enabled: sellAmountValid,
    routePreference: "auto",
  });

  const insufficientBalance = useMemo(() => {
    if (!sellAmountValid || !isConnected || ethBalanceWei === undefined)
      return false;
    try {
      const parsed = parseEther(sellAmount);
      return parsed > ethBalanceWei;
    } catch {
      return false;
    }
  }, [sellAmount, sellAmountValid, ethBalanceWei, isConnected]);

  const outputAmount =
    quote && quote.amountOut > 0n ? formatAmount(quote.amountOut) : "";

  return (
    <>
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
            onSlippageChange={onSlippageChange}
            presets={SLIPPAGE_PRESETS}
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
          {isQuoteLoading && <LoadingShapes />}
          <Flex
            bg="bauhaus.blue"
            color="white"
            px={3}
            py={1}
            align="center"
            flexShrink={0}
          >
            <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
              {buyTokenSymbol}
            </Text>
          </Flex>
        </HStack>

        {/* Route indicator */}
        {quote && (
          <Text
            fontSize="xs"
            color="gray.500"
            fontWeight="bold"
            textTransform="uppercase"
            textAlign="right"
            mt={1}
          >
            Route: {quote.route === "direct" ? "ETH→WCHAN" : "ETH→BNKRW→WCHAN"}
          </Text>
        )}
      </Box>

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

      {/* Action buttons */}
      {!isConnected ? (
        <Button
          variant="primary"
          size="lg"
          w="full"
          onClick={openConnectModal}
          fontSize="md"
          py={6}
        >
          Connect Wallet
        </Button>
      ) : isWrongChain ? (
        <Button
          size="lg"
          w="full"
          bg="orange.500"
          color="white"
          fontWeight="900"
          textTransform="uppercase"
          letterSpacing="wide"
          borderRadius={0}
          border="3px solid"
          borderColor="bauhaus.black"
          fontSize="md"
          py={6}
          _hover={{ bg: "orange.600" }}
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          leftIcon={
            <Image src="/images/base.svg" alt="Base" w="20px" h="20px" />
          }
        >
          Switch to Base
        </Button>
      ) : (
        <SwapButton
          direction="buy"
          quote={quote}
          chainId={CHAIN_ID}
          slippageBps={slippageBps}
          isQuoteLoading={isQuoteLoading}
          inputValid={sellAmountValid}
          insufficientBalance={insufficientBalance}
          onTxConfirmed={() => onTxConfirmed()}
        />
      )}
    </>
  );
}
