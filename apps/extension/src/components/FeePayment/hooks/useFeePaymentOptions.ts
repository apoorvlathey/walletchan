import { useEffect, useRef, useState } from "react";
import type { FeePaymentOption } from "@/chrome/feePayment/capabilities";
import type { FeePaymentTokenId } from "@/chrome/feePayment/tokens";
import type { FeePaymentRequestKind } from "../FeePaymentSelector";
import { automaticFeeToken } from "../model/automaticFeeToken";

const OPTIONS_REQUEST_TIMEOUT_MS = 10_000;

export function useFeePaymentOptions(input: {
  txId: string;
  chainId: number;
  requestKind: FeePaymentRequestKind;
  accountId?: string;
  requestPayload?: { chainId: number; calls: Array<{ to: string; data?: string; value?: string }> };
  value: FeePaymentTokenId;
  nativeInsufficient: boolean;
  disabled: boolean;
  onChange: (token: FeePaymentTokenId) => void;
  onOptionsLoadingChange?: (loading: boolean) => void;
}) {
  const { onChange, onOptionsLoadingChange } = input;
  // Scope results and user intent to the exact request, executor, chain and calls.
  const identity = JSON.stringify({
    requestKind: input.requestKind, txId: input.txId, accountId: input.accountId,
    chainId: input.chainId, requestPayload: input.requestPayload,
  });
  const [result, setResult] = useState<{ identity: string; options: FeePaymentOption[] } | null>(null);
  const selectionHandled = useRef<string | null>(null);
  const loading = result?.identity !== identity;
  const options = loading ? [] : result.options;

  useEffect(() => {
    let active = true;
    const finish = (options: FeePaymentOption[]) => {
      if (!active) return;
      active = false;
      window.clearTimeout(timeout);
      setResult({ identity, options });
    };
    const timeout = window.setTimeout(() => finish([]), OPTIONS_REQUEST_TIMEOUT_MS);
    const { requestKind, txId, accountId, requestPayload } = JSON.parse(identity);
    chrome.runtime.sendMessage(
      { type: "getFeePaymentOptions", txId, requestKind, accountId, requestPayload },
      (response: { success?: boolean; options?: FeePaymentOption[] } | undefined) => {
        const failed = Boolean(chrome.runtime.lastError);
        finish(!failed && response?.success ? response.options ?? [] : []);
      },
    );
    return () => { active = false; window.clearTimeout(timeout); };
  }, [identity]);

  const candidate = automaticFeeToken(options, input.nativeInsufficient, input.disabled);
  const shouldSelect = !loading && input.value === "native" &&
    selectionHandled.current !== identity && candidate !== null;
  useEffect(() => {
    if (!shouldSelect || !candidate) return;
    selectionHandled.current = identity;
    onChange(candidate);
  }, [candidate, identity, onChange, shouldSelect]);

  // Hold the native warning while discovery/automatic selection is pending.
  const pending = !input.disabled && (loading || shouldSelect);
  useEffect(() => {
    onOptionsLoadingChange?.(pending);
  }, [onOptionsLoadingChange, pending]);

  return {
    options, loading, identity,
    markManualSelection: () => { selectionHandled.current = identity; },
  };
}
