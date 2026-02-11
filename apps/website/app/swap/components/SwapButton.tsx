"use client";

import { useState, useEffect } from "react";
import { Button, VStack, Text, Link, HStack } from "@chakra-ui/react";
import { LoadingShapes } from "../../components/ui/LoadingShapes";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { erc20Abi, type Address, maxUint256 } from "viem";
import { base } from "wagmi/chains";
import { NATIVE_TOKEN_ADDRESS, SWAP_CHAIN_ID } from "../constants";
import type { SwapQuote } from "../types";

type SwapStep = "idle" | "switching" | "approving" | "quoting" | "swapping";

interface SwapButtonProps {
  sellToken: string;
  quote: SwapQuote | null;
  fetchFirmQuote: (taker: string) => Promise<SwapQuote | null>;
  isQuoteLoading: boolean;
  sellAmountValid: boolean;
  onTxConfirmed?: (hash: `0x${string}`) => void;
}

export function SwapButton({
  sellToken,
  quote,
  fetchFirmQuote,
  isQuoteLoading,
  sellAmountValid,
  onTxConfirmed,
}: SwapButtonProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<SwapStep>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const isNativeSell =
    sellToken.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();

  // Check current allowance for ERC20 sells
  const allowanceSpender = quote?.issues?.allowance?.spender as
    | Address
    | undefined;

  const { data: currentAllowance } = useReadContract({
    address: sellToken as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && allowanceSpender ? [address, allowanceSpender] : undefined,
    chainId: base.id,
    query: {
      enabled: !isNativeSell && !!address && !!allowanceSpender,
    },
  });

  const needsApproval =
    !isNativeSell &&
    quote?.issues?.allowance &&
    currentAllowance !== undefined &&
    currentAllowance < BigInt(quote.sellAmount);

  // Notify parent when tx confirms so balance can refresh
  useEffect(() => {
    if (isConfirmed && txHash) {
      onTxConfirmed?.(txHash);
    }
  }, [isConfirmed, txHash, onTxConfirmed]);

  const handleSwap = async () => {
    if (!address || !isConnected) return;

    setError(null);
    setTxHash(undefined);

    try {
      // Step 1: Switch chain if needed
      if (chainId !== SWAP_CHAIN_ID) {
        setStep("switching");
        await switchChainAsync({ chainId: SWAP_CHAIN_ID });
      }

      // Step 2: Approve if needed (ERC20 only)
      if (needsApproval && allowanceSpender) {
        setStep("approving");
        await writeContractAsync({
          address: sellToken as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [allowanceSpender, maxUint256],
          chainId: base.id,
        });
        // Wait briefly for approval to be mined
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Step 3: Fetch firm quote
      setStep("quoting");
      const firmQuote = await fetchFirmQuote(address);
      if (!firmQuote?.transaction) {
        throw new Error("Failed to get firm quote");
      }

      // Step 4: Execute swap
      setStep("swapping");
      const hash = await sendTransactionAsync({
        to: firmQuote.transaction.to as Address,
        data: firmQuote.transaction.data as `0x${string}`,
        value: BigInt(firmQuote.transaction.value || "0"),
        chainId: base.id,
      });

      setTxHash(hash);
      setStep("idle");
    } catch (err: unknown) {
      setStep("idle");
      if (err instanceof Error) {
        // Don't show user rejection as an error
        if (
          err.message.includes("User rejected") ||
          err.message.includes("User denied")
        ) {
          return;
        }
        setError(err.message);
      } else {
        setError("Swap failed");
      }
    }
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (!sellAmountValid) return "Enter Amount";
    if (isQuoteLoading) return "Fetching Quote...";
    if (!quote) return "Enter Amount";
    if (chainId !== SWAP_CHAIN_ID) return "Switch to Base";
    if (step === "switching") return "Switching Chain...";
    if (step === "approving") return "Approving Token...";
    if (step === "quoting") return "Swapping...";
    if (step === "swapping") return "Confirm in Wallet...";
    if (isConfirming) return "Confirming...";
    if (needsApproval) return "Approve & Swap";
    return "Swap";
  };

  const isDisabled =
    !isConnected ||
    !quote ||
    !sellAmountValid ||
    step !== "idle" ||
    isQuoteLoading ||
    isConfirming;

  return (
    <VStack spacing={3} align="stretch">
      <Button
        variant={needsApproval ? "yellow" : "primary"}
        size="lg"
        w="full"
        onClick={handleSwap}
        isDisabled={isDisabled}
        fontSize="md"
        py={6}
      >
        <HStack spacing={3}>
          {(step !== "idle" || isConfirming || isQuoteLoading) && (
            <LoadingShapes />
          )}
          <Text>{getButtonText()}</Text>
        </HStack>
      </Button>

      {error && (
        <Text
          fontSize="sm"
          color="bauhaus.red"
          fontWeight="bold"
          textAlign="center"
        >
          {error}
        </Text>
      )}

      {isConfirmed && txHash && (
        <Text fontSize="sm" fontWeight="bold" textAlign="center">
          Swap confirmed!{" "}
          <Link
            href={`https://basescan.org/tx/${txHash}`}
            isExternal
            color="bauhaus.blue"
            textDecoration="underline"
          >
            View on BaseScan
          </Link>
        </Text>
      )}
    </VStack>
  );
}
