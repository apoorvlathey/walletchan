import { Text } from "@chakra-ui/react";
import { WarningAcknowledgementPopover } from "@/components/shared/WarningAcknowledgementPopover";
import type { useSwapPriceImpactDecision } from "./useSwapPriceImpactDecision";

interface Props {
  priceImpact: number | null;
  decision: ReturnType<typeof useSwapPriceImpactDecision>["decision"];
  isSubmitting: boolean;
}

export function SwapPriceImpactNotice({ priceImpact, decision, isSubmitting }: Props) {
  if (!decision.requiresAcknowledgement || priceImpact === null) return null;
  return (
    <WarningAcknowledgementPopover
      matchTriggerWidth
      tone={priceImpact > 10 ? "error" : "warning"}
      label={`${priceImpact > 10 ? "High price impact" : "Price impact"} (~${priceImpact.toFixed(1)}%)`}
      title="Review price impact"
      acknowledgement="I understand the price impact and want to continue."
      isOpen={decision.isOpen}
      isAcknowledged={decision.acknowledged}
      isDisabled={isSubmitting}
      onOpenChange={decision.setOpen}
      onAcknowledgedChange={decision.setAcknowledged}
    >
      <Text>
        {priceImpact > 10
          ? `High price impact (~${priceImpact.toFixed(1)}%). You may receive significantly fewer tokens.`
          : `Price impact is ~${priceImpact.toFixed(1)}%.`}
      </Text>
    </WarningAcknowledgementPopover>
  );
}
