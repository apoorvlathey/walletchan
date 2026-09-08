import { useState } from "react";
import { analyzeSafeTransactionRisk, analyzeSafeTypedDataRisk } from "@/chrome/safe/transactionRisk";

type Input = { chainId: number } & ({ typedData: unknown; transaction?: never } | { transaction: unknown; typedData?: never });

/** Bind acknowledgement synchronously to exact reviewed content and actor/action. */
export function useSafeRiskDecision(input: Input, reviewKey: string) {
  const risk = "transaction" in input
    ? analyzeSafeTransactionRisk(input.transaction, input.chainId)
    : analyzeSafeTypedDataRisk(input.typedData, input.chainId);
  const key = JSON.stringify([reviewKey, input]);
  const [state, setState] = useState({ key, acknowledged: false, isOpen: false });
  const current = state.key === key ? state : { key, acknowledged: false, isOpen: false };
  if (state.key !== key) setState(current);
  return {
    risk,
    blocked: Boolean(risk?.delegatecall || risk?.refund) && !current.acknowledged,
    acknowledged: current.acknowledged,
    isOpen: current.isOpen,
    setAcknowledged: (value: boolean) => setState({ ...current, acknowledged: value }),
    setOpen: (value: boolean) => setState({ ...current, isOpen: value }),
  };
}
