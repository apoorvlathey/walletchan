import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { AddressParam } from "@/components/decodedParams/AddressParam";
import {
  appendTokenSymbol,
  formatTokenBaseUnits,
} from "@/lib/tokenAmountFormat";

function SummaryRow({
  label,
  children,
  divider = true,
}: {
  label: string;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <HStack
      minH="48px"
      px={3}
      py={2.5}
      spacing={3}
      justify="space-between"
      borderTopWidth={divider ? "1px" : 0}
      borderTopStyle="solid"
      borderTopColor="border.subtle"
    >
      <Text color="fg.secondary" fontSize="xs" fontWeight="600" flexShrink={0}>
        {label}
      </Text>
      <Box minW={0} textAlign="right">
        {children}
      </Box>
    </HStack>
  );
}

function formatNativeValue(value: string | undefined, symbol: string): string {
  if (!value) return `0 ${symbol}`;
  const formatted = formatTokenBaseUnits(value, 18, true);
  return formatted ? appendTokenSymbol(formatted, symbol) : `0 ${symbol}`;
}

export default function DecodedFunctionSummary({
  functionName,
  details,
  contractAddress,
  chainId,
  value,
  nativeSymbol,
  valueUsd,
}: {
  functionName: string;
  details?: ReactNode;
  contractAddress?: string;
  chainId: number;
  value: string | undefined;
  nativeSymbol: string;
  valueUsd: string | null;
}) {
  let hasValue = false;
  try {
    hasValue = Boolean(value && BigInt(value) !== 0n);
  } catch {
    hasValue = false;
  }

  return (
    <Box
      bg="surface.raised"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="border.default"
      borderRadius="lg"
      overflow="hidden"
    >
      <VStack align="stretch" spacing={0}>
        <SummaryRow label="Action" divider={false}>
          <Text
            minW={0}
            color="fg.primary"
            fontSize="md"
            fontWeight="700"
            lineHeight="short"
            textAlign="right"
            overflowWrap="anywhere"
          >
            {functionName}
          </Text>
        </SummaryRow>

        {details && (
          <Box
            borderTopWidth="1px"
            borderTopStyle="solid"
            borderTopColor="border.subtle"
            sx={{ "&:empty": { display: "none" } }}
          >
            {details}
          </Box>
        )}

        {contractAddress && (
          <SummaryRow label="Contract">
            <AddressParam
              value={contractAddress}
              chainId={chainId}
              contextLabel="contract address"
            />
          </SummaryRow>
        )}

        {hasValue && (
          <SummaryRow label="Payment">
            <VStack spacing={0} align="flex-end">
              <Text
                color="fg.primary"
                fontSize="sm"
                fontWeight="700"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatNativeValue(value, nativeSymbol)}
              </Text>
              {valueUsd && (
                <Text color="fg.secondary" fontSize="2xs" fontWeight="600">
                  {valueUsd}
                </Text>
              )}
            </VStack>
          </SummaryRow>
        )}
      </VStack>
    </Box>
  );
}
