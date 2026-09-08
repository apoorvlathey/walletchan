import { WarningAcknowledgementPopover } from "@/components/shared/WarningAcknowledgementPopover";
import { SafeTransactionWarnings } from "./SafeTransactionWarnings";
import type { useSafeRiskDecision } from "./useSafeRiskDecision";

export function SafeRiskDecision({ decision, isDisabled = false }: {
  decision: ReturnType<typeof useSafeRiskDecision>;
  isDisabled?: boolean;
}) {
  if (!decision.risk?.delegatecall && !decision.risk?.refund) return null;
  const label = decision.risk.delegatecall
    ? decision.risk.refund ? "Delegatecall and gas reimbursement" : "Delegatecall warning"
    : "Gas reimbursement enabled";
  return (
    <WarningAcknowledgementPopover
      matchTriggerWidth
      tone="error" label={label} title="Review Safe transaction warnings"
      acknowledgement="I understand the warnings and want to proceed."
      isOpen={decision.isOpen} isAcknowledged={decision.acknowledged}
      isDisabled={isDisabled} onOpenChange={decision.setOpen}
      onAcknowledgedChange={decision.setAcknowledged}
    >
      <SafeTransactionWarnings risk={decision.risk} />
    </WarningAcknowledgementPopover>
  );
}
