import { useState } from "react";
import { formatUnits } from "viem";

interface Input {
  inputUsd: number;
  outputAmount?: string;
  buyTokenDecimals?: number;
  buyTokenPriceUsd: number;
  quoteLoading: boolean;
  reviewContext: unknown[];
}

/** An acknowledgement applies only to the currently reviewed quote and inputs. */
export function useSwapPriceImpactDecision(input: Input) {
  const outputUsd = input.outputAmount && input.buyTokenDecimals !== undefined && input.buyTokenPriceUsd > 0
    ? Number(formatUnits(BigInt(input.outputAmount), input.buyTokenDecimals)) * input.buyTokenPriceUsd
    : 0;
  const priceImpact = !input.quoteLoading && input.inputUsd > 0 && outputUsd > 0
    ? ((input.inputUsd - outputUsd) / input.inputUsd) * 100
    : null;
  const reviewKey = JSON.stringify([input.reviewContext, input.inputUsd, outputUsd, priceImpact, input.quoteLoading]);
  const [state, setState] = useState({ key: reviewKey, acknowledged: false, isOpen: false });
  const current = state.key === reviewKey
    ? state
    : { key: reviewKey, acknowledged: false, isOpen: false };
  // Reset during render so even A → B → A cannot revive an old checkbox.
  if (state.key !== reviewKey) setState(current);
  const requiresAcknowledgement = priceImpact !== null && priceImpact > 3;
  return {
    outputUsd,
    priceImpact,
    decision: {
      requiresAcknowledgement,
      blocked: requiresAcknowledgement && !current.acknowledged,
      acknowledged: current.acknowledged,
      isOpen: current.isOpen,
      setAcknowledged: (value: boolean) => setState((previous) =>
        previous.key === reviewKey ? { ...previous, acknowledged: value } : previous),
      setOpen: (value: boolean) => setState((previous) =>
        previous.key === reviewKey ? { ...previous, isOpen: value } : previous),
    },
  };
}
