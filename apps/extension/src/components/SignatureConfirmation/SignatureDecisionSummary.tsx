import { HStack, Text, VStack } from "@chakra-ui/react";
import { FromAccountDisplay } from "@/components/FromAccountDisplay";
import { WarningAcknowledgementPopover } from "@/components/shared/WarningAcknowledgementPopover";

export interface UnsafeSiweDecisionProps {
  isOpen: boolean;
  isAcknowledged: boolean;
  blockingError: string;
  isDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}

export function SignatureDecisionSummary({
  chainId,
  address,
  unsafeSiweDecision,
}: {
  address: string;
  chainId: number;
  unsafeSiweDecision?: UnsafeSiweDecisionProps;
}) {
  return (
    <VStack align="stretch" spacing={2}>
      <HStack minW={0} justify="space-between" spacing={3}>
        <Text
          color="fg.secondary"
          fontSize="xs"
          fontWeight="600"
          flexShrink={0}
        >
          Signing with
        </Text>
        <HStack minW={0} justify="flex-end">
          <FromAccountDisplay chainId={chainId} address={address} />
        </HStack>
      </HStack>
      {unsafeSiweDecision && (
        <WarningAcknowledgementPopover {...unsafeSiweDecision}>
          <Text>{unsafeSiweDecision.blockingError}</Text>
        </WarningAcknowledgementPopover>
      )}
    </VStack>
  );
}
