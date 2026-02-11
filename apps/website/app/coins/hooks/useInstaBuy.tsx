"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain, useSendTransaction } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Box, HStack, Text, Spinner, CloseButton, Link, useToast } from "@chakra-ui/react";
import { parseEther, type Address } from "viem";
import { base } from "wagmi/chains";
import {
  NATIVE_TOKEN_ADDRESS,
  SWAP_CHAIN_ID,
  DEFAULT_SLIPPAGE_BPS,
} from "../../swap/constants";

type ToastVariant = "loading" | "success" | "error";

const VARIANT_STYLES: Record<ToastVariant, { accent: string }> = {
  loading: { accent: "bauhaus.blue" },
  success: { accent: "bauhaus.green" },
  error: { accent: "bauhaus.red" },
};

function BauhausToast({
  title,
  description,
  variant,
  onClose,
  link,
}: {
  title: string;
  description?: string;
  variant: ToastVariant;
  onClose: () => void;
  link?: { href: string; label: string };
}) {
  const style = VARIANT_STYLES[variant];

  return (
    <Box
      bg="white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      overflow="hidden"
      minW="280px"
      maxW="380px"
    >
      <HStack spacing={0} align="stretch">
        <Box w="6px" bg={style.accent} flexShrink={0} />
        <HStack flex={1} px={4} py={3} spacing={3}>
          {variant === "loading" && <Spinner size="sm" color={style.accent} thickness="3px" />}
          {variant === "success" && (
            <Text fontSize="lg" lineHeight={1} color="bauhaus.green">&#x2713;</Text>
          )}
          {variant === "error" && (
            <Text fontSize="lg" lineHeight={1} fontWeight="900" color="bauhaus.red">&#x2717;</Text>
          )}
          <Box flex={1}>
            <Text
              fontWeight="800"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              {title}
            </Text>
            {description && (
              <Text fontSize="xs" color="gray.600" fontWeight="500" mt={0.5}>
                {description}
              </Text>
            )}
            {link && (
              <Link
                href={link.href}
                isExternal
                fontSize="xs"
                fontWeight="700"
                color="bauhaus.blue"
                textDecoration="underline"
                mt={0.5}
                display="block"
              >
                {link.label}
              </Link>
            )}
          </Box>
          <CloseButton size="sm" onClick={onClose} borderRadius={0} />
        </HStack>
      </HStack>
    </Box>
  );
}

export function useInstaBuy() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { openConnectModal } = useConnectModal();
  const toast = useToast();

  const [isBuying, setIsBuying] = useState(false);

  const showToast = useCallback(
    (opts: {
      title: string;
      description?: string;
      variant: ToastVariant;
      duration?: number | null;
      link?: { href: string; label: string };
    }) => {
      return toast({
        duration: opts.duration ?? null,
        isClosable: true,
        position: "bottom-right",
        render: ({ onClose }) => (
          <BauhausToast
            title={opts.title}
            description={opts.description}
            variant={opts.variant}
            onClose={onClose}
            link={opts.link}
          />
        ),
      });
    },
    [toast]
  );

  const instaBuy = useCallback(
    async (coinAddress: string, amountEth: string) => {
      if (!isConnected || !address) {
        openConnectModal?.();
        return;
      }

      setIsBuying(true);

      const toastId = showToast({
        title: "Fetching quote...",
        variant: "loading",
      });

      try {
        // Switch chain if needed
        if (chainId !== SWAP_CHAIN_ID) {
          toast.update(toastId, {
            render: ({ onClose }) => (
              <BauhausToast title="Switching to Base..." variant="loading" onClose={onClose} />
            ),
          });
          await switchChainAsync({ chainId: SWAP_CHAIN_ID });
        }

        // Fetch firm quote
        const sellAmountWei = parseEther(amountEth).toString();
        const params = new URLSearchParams({
          sellToken: NATIVE_TOKEN_ADDRESS,
          buyToken: coinAddress,
          sellAmount: sellAmountWei,
          taker: address,
          slippageBps: DEFAULT_SLIPPAGE_BPS.toString(),
        });

        const res = await fetch(`/api/swap/quote?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || data.reason || `Quote failed: ${res.status}`);
        }

        const firmQuote = await res.json();
        if (!firmQuote?.transaction) {
          throw new Error("No transaction in quote response");
        }

        // Send transaction
        toast.update(toastId, {
          render: ({ onClose }) => (
            <BauhausToast title="Confirm in wallet..." variant="loading" onClose={onClose} />
          ),
        });

        const hash = await sendTransactionAsync({
          to: firmQuote.transaction.to as Address,
          data: firmQuote.transaction.data as `0x${string}`,
          value: BigInt(firmQuote.transaction.value || "0"),
          chainId: base.id,
        });

        toast.close(toastId);
        showToast({
          title: "Swap confirmed!",
          variant: "success",
          duration: 8000,
          link: {
            href: `https://basescan.org/tx/${hash}`,
            label: "View on BaseScan",
          },
        });
      } catch (err: unknown) {
        toast.close(toastId);
        if (err instanceof Error) {
          if (
            err.message.includes("User rejected") ||
            err.message.includes("User denied")
          ) {
            return;
          }
          showToast({
            title: "Insta Buy failed",
            description: err.message,
            variant: "error",
            duration: 6000,
          });
        } else {
          showToast({
            title: "Insta Buy failed",
            variant: "error",
            duration: 6000,
          });
        }
      } finally {
        setIsBuying(false);
      }
    },
    [isConnected, address, chainId, switchChainAsync, sendTransactionAsync, openConnectModal, toast, showToast]
  );

  return { instaBuy, isBuying };
}
