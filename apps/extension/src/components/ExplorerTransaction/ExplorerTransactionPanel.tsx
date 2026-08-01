import { RepeatIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  HStack,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import CalldataDecoder from "@/components/CalldataDecoder";
import { ClearSigningView } from "@/components/ClearSigning/ClearSigningView";
import BatchCallsSummary from "@/components/shared/BatchCallsSummary";
import DecodedFunctionSummary from "@/components/shared/DecodedFunctionSummary";
import {
  decodeErc7821Batch,
  looksLikeErc7821SelfBatch,
} from "@/lib/erc7821Decode";
import type {
  ExplorerRpcTransaction,
  ExplorerTransactionPage,
} from "@/lib/explorerTransaction";
import { ThemedCard } from "@/theme/primitives/ThemedCard";

function SummarySkeleton() {
  return (
    <ThemedCard variant="default" weight="thin" overflow="hidden" boxShadow="none">
      <VStack align="stretch" spacing={0}>
        <HStack minH="48px" px={3} py={2.5} justify="space-between">
          <Skeleton height="13px" width="54px" />
          <Skeleton height="18px" width="34%" />
        </HStack>
        <HStack
          minH="48px"
          px={3}
          py={2.5}
          justify="space-between"
          borderTop="1px solid"
          borderColor="border.subtle"
        >
          <Skeleton height="13px" width="64px" />
          <Skeleton height="30px" width="42%" />
        </HStack>
      </VStack>
    </ThemedCard>
  );
}

export function ExplorerTransactionLoading({
  page,
}: {
  page: ExplorerTransactionPage;
}) {
  return (
    <VStack
      align="stretch"
      spacing={3}
      py={2}
      aria-label={`Loading ${page.chain.name} transaction summary`}
    >
      <SummarySkeleton />
      <Skeleton height="44px" borderRadius="lg" />
    </VStack>
  );
}

export function ExplorerTransactionError({
  page,
  message,
  onRetry,
}: {
  page: ExplorerTransactionPage;
  message: string;
  onRetry: () => void;
}) {
  return (
    <ThemedCard
      variant="default"
      weight="thin"
      boxShadow="none"
      px={3}
      py={3}
      my={2}
    >
      <HStack spacing={3} align="center">
        <Box flex={1} minW={0}>
          <Text color="fg.primary" fontSize="sm" fontWeight="700">
            Decode unavailable on {page.chain.name}
          </Text>
          <Text color="fg.secondary" fontSize="xs">
            {message}
          </Text>
        </Box>
        <Button leftIcon={<RepeatIcon />} variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </HStack>
    </ThemedCard>
  );
}

export default function ExplorerTransactionPanel({
  page,
  transaction,
}: {
  page: ExplorerTransactionPage;
  transaction: ExplorerRpcTransaction;
}) {
  const [clearIntent, setClearIntent] = useState<string>();
  const [functionName, setFunctionName] = useState<string>();
  const hasCalldata = transaction.input !== "0x";
  const batchCalls = useMemo(() => {
    const tx = {
      from: transaction.from,
      to: transaction.to,
      data: transaction.input,
    };
    return looksLikeErc7821SelfBatch(tx)
      ? decodeErc7821Batch(transaction.input)
      : null;
  }, [transaction.from, transaction.input, transaction.to]);
  const action = useMemo(
    () =>
      clearIntent ||
      functionName ||
      (!transaction.to
        ? "Contract deployment"
        : hasCalldata
          ? "Contract interaction"
          : "Native transfer"),
    [clearIntent, functionName, hasCalldata, transaction.to],
  );

  if (batchCalls?.length) {
    return (
      <Box py={2}>
        <BatchCallsSummary
          calls={batchCalls}
          chainId={page.chain.chainId}
          hideCalldataDigest
        />
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={3} py={2}>
      <DecodedFunctionSummary
        functionName={action}
        details={
          transaction.to && hasCalldata ? (
            <ClearSigningView
              kind="calldata"
              chainId={page.chain.chainId}
              from={transaction.from}
              to={transaction.to}
              calldata={transaction.input}
              value={transaction.value}
              embedded
              hideLoadingSkeleton
              hideHeader
              onResolved={(matched, intent) => {
                setClearIntent(matched ? intent : undefined);
              }}
            />
          ) : undefined
        }
        chainId={page.chain.chainId}
        value={transaction.value}
        nativeSymbol={page.chain.nativeCurrency.symbol}
        valueUsd={null}
      />

      {transaction.to && hasCalldata ? (
        <CalldataDecoder
          calldata={transaction.input}
          to={transaction.to}
          chainId={page.chain.chainId}
          onFunctionName={setFunctionName}
          collapsible
        />
      ) : (
        <Box
          bg="surface.sunken"
          border="1px solid"
          borderColor="border.default"
          borderRadius="lg"
          px={3}
          py={3}
        >
          <Text color="fg.secondary" fontSize="sm">
            {transaction.to
              ? "This transaction contains no calldata."
              : "Contract creation bytecode is kept on the explorer and is not decoded as a contract call."}
          </Text>
        </Box>
      )}
    </VStack>
  );
}
