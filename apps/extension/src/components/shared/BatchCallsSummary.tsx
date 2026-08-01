import { Badge, HStack, Text, VStack } from "@chakra-ui/react";

import type { ERC5792Call } from "@/chrome/erc5792Types";
import type { TxCallOrigin } from "@/chrome/txHistoryStorage";
import { BatchCallsList } from "@/components/BatchCallsList";

export default function BatchCallsSummary({
  calls,
  chainId,
  origin,
  favicon,
  originPerCall,
  originCallIndex,
  hideCalldataDigest = false,
}: {
  calls: ERC5792Call[];
  chainId: number;
  origin?: string;
  favicon?: string | null;
  originPerCall?: TxCallOrigin[];
  originCallIndex?: number;
  hideCalldataDigest?: boolean;
}) {
  return (
    <VStack spacing={2} align="stretch">
      <HStack spacing={2}>
        <Text
          fontSize="xs"
          color="text.secondary"
          fontWeight="700"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          Calls
        </Text>
        <Badge
          bg="accent.highlight"
          color="accentFg.highlight"
          fontSize="2xs"
          fontWeight="800"
          px={1.5}
          py={0}
          border="1px solid"
          borderColor="accent.highlight"
        >
          {calls.length}
        </Badge>
      </HStack>
      <BatchCallsList
        calls={calls}
        chainId={chainId}
        origin={origin}
        favicon={favicon}
        originPerCall={originPerCall}
        originCallIndex={originCallIndex}
        hideCalldataDigest={hideCalldataDigest}
      />
    </VStack>
  );
}
