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
  useWriteContract,
  usePublicClient,
  useSignTypedData,
} from "wagmi";
import { erc20Abi, maxUint256, type Address, type Hex } from "viem";
import {
  type SwapDirection,
  type WchanQuote,
  getAddresses,
  isChainLive,
  applySlippage,
  encodeBuyWchan,
  encodeSellWchan,
  encodeBuyWchanViaBnkrw,
  encodeSellWchanViaBnkrw,
  getErc20AllowanceToPermit2,
  getPermit2Allowance,
  buildPermitSingle,
  getPermitTypedData,
} from "../../../lib/wchan-swap";

type SwapStep =
  | "idle"
  | "switching"
  | "approving"
  | "signing-permit"
  | "swapping";

interface SwapButtonProps {
  direction: SwapDirection;
  quote: WchanQuote | null;
  chainId: number;
  slippageBps: number;
  isQuoteLoading: boolean;
  inputValid: boolean;
  insufficientBalance: boolean;
  onTxConfirmed?: (hash: `0x${string}`) => void;
}

export function SwapButton({
  direction,
  quote,
  chainId,
  slippageBps,
  isQuoteLoading,
  inputValid,
  insufficientBalance,
  onTxConfirmed,
}: SwapButtonProps) {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const client = usePublicClient({ chainId });

  const [step, setStep] = useState<SwapStep>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const live = isChainLive(chainId);

  useEffect(() => {
    if (isConfirmed && txHash) {
      onTxConfirmed?.(txHash);
    }
  }, [isConfirmed, txHash, onTxConfirmed]);

  const handleSwap = async () => {
    if (!address || !isConnected || !quote || !client) return;

    setError(null);
    setTxHash(undefined);

    try {
      // 1. Switch chain if needed
      if (currentChainId !== chainId) {
        setStep("switching");
        await switchChainAsync({ chainId });
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
      const minAmountOut = applySlippage(quote.amountOut, slippageBps);

      if (direction === "buy") {
        // Buy: ETH → WCHAN (direct or via BNKRW)
        setStep("swapping");
        const tx =
          quote.route === "via-bnkrw"
            ? encodeBuyWchanViaBnkrw(chainId, quote.amountIn, minAmountOut, deadline)
            : encodeBuyWchan(chainId, quote.amountIn, minAmountOut, deadline);
        const hash = await sendTransactionAsync({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId,
        });
        setTxHash(hash);
      } else {
        // Sell: WCHAN → ETH
        const addrs = getAddresses(chainId);

        // 2a. Check & approve WCHAN → Permit2 (ERC20 allowance)
        const erc20Allowance = await getErc20AllowanceToPermit2(
          client,
          chainId,
          address
        );
        if (erc20Allowance < quote.amountIn) {
          setStep("approving");
          const approveHash = await writeContractAsync({
            address: addrs.wchan,
            abi: erc20Abi,
            functionName: "approve",
            args: [addrs.permit2, maxUint256],
            chainId,
          });
          // Wait for approval tx to be confirmed on-chain
          await client.waitForTransactionReceipt({ hash: approveHash });
        }

        // 2b. Check Permit2 allowance → Universal Router
        const permit2Allowance = await getPermit2Allowance(
          client,
          chainId,
          address,
          addrs.universalRouter
        );

        let permit:
          | { permitSingle: ReturnType<typeof buildPermitSingle>; signature: Hex }
          | undefined;

        const now = Math.floor(Date.now() / 1000);
        const needsPermit =
          permit2Allowance.amount < quote.amountIn ||
          permit2Allowance.expiration < now;

        if (needsPermit) {
          setStep("signing-permit");
          const permitSingle = buildPermitSingle(
            chainId,
            BigInt("0x" + "f".repeat(40)) as bigint, // uint160 max
            permit2Allowance.nonce,
            addrs.universalRouter
          );
          const typedData = getPermitTypedData(chainId, permitSingle);
          const signature = await signTypedDataAsync({
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
          });
          permit = { permitSingle, signature };
        }

        // 3. Execute sell swap (direct or via BNKRW)
        setStep("swapping");
        const tx =
          quote.route === "via-bnkrw"
            ? encodeSellWchanViaBnkrw(
                chainId,
                quote.amountIn,
                minAmountOut,
                deadline,
                permit
              )
            : encodeSellWchan(
                chainId,
                quote.amountIn,
                minAmountOut,
                deadline,
                permit
              );
        const hash = await sendTransactionAsync({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId,
        });
        setTxHash(hash);
      }

      setStep("idle");
    } catch (err: unknown) {
      setStep("idle");
      if (err instanceof Error) {
        if (
          err.message.includes("User rejected") ||
          err.message.includes("User denied")
        ) {
          return;
        }
        setError(err.message.slice(0, 200));
      } else {
        setError("Swap failed");
      }
    }
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (!live) return "Coming Soon";
    if (!inputValid) return "Enter Amount";
    if (insufficientBalance) return "Insufficient Balance";
    if (isQuoteLoading) return "Fetching Quote...";
    if (!quote) return "Enter Amount";
    if (currentChainId !== chainId) return "Switch to Base";
    if (step === "switching") return "Switching Chain...";
    if (step === "approving") return "Approving WCHAN...";
    if (step === "signing-permit") return "Sign Permit...";
    if (step === "swapping") return "Confirm in Wallet...";
    if (isConfirming) return "Confirming...";
    return direction === "buy" ? "Buy WCHAN" : "Sell WCHAN";
  };

  const isDisabled =
    !isConnected ||
    !live ||
    !quote ||
    !inputValid ||
    insufficientBalance ||
    step !== "idle" ||
    isQuoteLoading ||
    isConfirming;

  const explorerBase = "https://basescan.org";

  return (
    <VStack spacing={3} align="stretch">
      <Button
        variant={direction === "buy" ? "green" : "primary"}
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
            href={`${explorerBase}/tx/${txHash}`}
            isExternal
            color="bauhaus.blue"
            textDecoration="underline"
          >
            View on Etherscan
          </Link>
        </Text>
      )}
    </VStack>
  );
}
