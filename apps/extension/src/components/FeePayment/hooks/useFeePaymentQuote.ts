import { useCallback, useEffect, useRef, useState } from "react";
import type { FeePaymentOption } from "@/chrome/feePayment/capabilities";
import type { FeePaymentTokenId } from "@/chrome/feePayment/tokens";
import type { FeePaymentQuoteSummary, FeePaymentRequestKind } from "../FeePaymentSelector";

import { isTransactionSignatureExpired } from "../model/quoteError";

const QUOTE_REQUEST_TIMEOUT_MS = 30_000;
const AUTO_REFRESH_LIMIT = 5;
const REFRESH_BEFORE_EXPIRY_MS = 15_000;
const EXPIRY_MARGIN_MS = 1_000;

/** Shared by every fee selector; preparation never signs or submits a transaction. */
export function useFeePaymentQuote({
  requestIdentity, txId, requestKind, accountId, requestPayload,
  value, quote, options, disabled, onQuoteChange,
}: {
  requestIdentity: string;
  txId: string;
  requestKind: FeePaymentRequestKind;
  accountId?: string;
  requestPayload?: { chainId: number; calls: Array<{ to: string; data?: string; value?: string }> };
  value: FeePaymentTokenId;
  quote: FeePaymentQuoteSummary | null;
  options: FeePaymentOption[];
  disabled: boolean;
  onQuoteChange: (quote: FeePaymentQuoteSummary | null) => void;
}) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const quoteRequestSequence = useRef(0);
  const quoteRequestStarted = useRef(Boolean(quote));
  const previousRequestIdentity = useRef(requestIdentity);
  const quoteTimeoutRef = useRef<number | null>(null);
  const refreshCount = useRef(0);
  const refreshingQuoteId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const latest = useRef({ quote, value, requestIdentity, disabled });
  latest.current = { quote, value, requestIdentity, disabled };

  const clearQuoteTimeout = useCallback(() => {
    if (quoteTimeoutRef.current === null) return;
    window.clearTimeout(quoteTimeoutRef.current);
    quoteTimeoutRef.current = null;
  }, []);

  const cancelQuoteRequest = useCallback(() => {
    quoteRequestSequence.current += 1;
    clearQuoteTimeout();
    inFlight.current = false;
    setQuoteLoading(false);
  }, [clearQuoteTimeout]);

  const resetQuoteState = useCallback(() => {
    cancelQuoteRequest();
    quoteRequestStarted.current = false;
    refreshCount.current = 0;
    refreshingQuoteId.current = null;
    setQuoteError("");
  }, [cancelQuoteRequest]);

  const requestQuote = useCallback((requestedTokenId?: FeePaymentTokenId, automatic = false) => {
    const tokenId = requestedTokenId ?? value;
    if (tokenId === "native" || latest.current.disabled) return;
    if (automatic) {
      if (inFlight.current || refreshCount.current >= AUTO_REFRESH_LIMIT) return;
      refreshCount.current += 1;
      refreshingQuoteId.current = latest.current.quote?.quoteId ?? null;
    } else {
      // Initial selection and explicit Retry each start a fresh allowance.
      refreshCount.current = 0;
      refreshingQuoteId.current = null;
    }
    const tokenSymbol = options.find((candidate) => candidate.id === tokenId)?.symbol ?? "Token";
    clearQuoteTimeout();
    const sequence = ++quoteRequestSequence.current;
    quoteRequestStarted.current = true;
    inFlight.current = true;
    setQuoteLoading(true);
    setQuoteError("");
    if (!automatic) onQuoteChange(null);
    const isCurrent = () => sequence === quoteRequestSequence.current &&
      latest.current.requestIdentity === requestIdentity && latest.current.value === tokenId &&
      !latest.current.disabled;
    const fail = (message: string) => {
      setQuoteError(message);
      const current = latest.current.quote;
      if (isTransactionSignatureExpired(message) || !current || current.expiresAt <= Date.now() + EXPIRY_MARGIN_MS) onQuoteChange(null);
      inFlight.current = false;
      setQuoteLoading(false);
    };
    quoteTimeoutRef.current = window.setTimeout(() => {
      if (!isCurrent()) return;
      quoteRequestSequence.current += 1;
      quoteTimeoutRef.current = null;
      fail(`${tokenSymbol} gas quote timed out`);
    }, QUOTE_REQUEST_TIMEOUT_MS);
    chrome.runtime.sendMessage(
      {
        type: "prepareFeePaymentQuote", requestId: txId, requestKind,
        accountId, requestPayload, feePaymentToken: tokenId,
      },
      (result: Partial<FeePaymentQuoteSummary> & { success?: boolean; error?: string }) => {
        const runtimeError = chrome.runtime.lastError;
        if (!isCurrent()) return;
        clearQuoteTimeout();
        if (runtimeError) {
          fail(`${tokenSymbol} gas quote is unavailable`);
          return;
        }
        if (
          !result?.success || !result.quoteId || result.tokenId !== tokenId ||
          !result.tokenAddress || !result.tokenSymbol ||
          !Number.isInteger(result.tokenDecimals) ||
          typeof result.tokenStablecoin !== "boolean" || !result.maximumTokenCost ||
          !Number.isFinite(result.expiresAt) || result.expiresAt! <= Date.now() + EXPIRY_MARGIN_MS ||
          result.tokenBalance === undefined || !result.paymaster || !result.userOperationNonce ||
          typeof result.sufficientBalance !== "boolean" || typeof result.needsAuthorization !== "boolean"
        ) {
          fail(result?.error || `${tokenSymbol} gas quote is unavailable`);
          return;
        }
        const summary: FeePaymentQuoteSummary = {
          quoteId: result.sufficientBalance ? result.quoteId : null,
          tokenId: result.tokenId,
          tokenAddress: result.tokenAddress,
          tokenSymbol: result.tokenSymbol,
          tokenDecimals: result.tokenDecimals!,
          tokenStablecoin: result.tokenStablecoin,
          maximumTokenCost: result.maximumTokenCost,
          tokenBalance: result.tokenBalance,
          expiresAt: result.expiresAt!,
          approvalAdded: result.approvalAdded === true,
          approvalAmount: result.approvalAmount ?? null,
          paymaster: result.paymaster,
          userOperationNonce: result.userOperationNonce,
          sufficientBalance: result.sufficientBalance,
          needsAuthorization: result.needsAuthorization,
        };
        if (!summary.sufficientBalance) {
          setQuoteError(`Insufficient ${summary.tokenSymbol} balance for the maximum gas charge`);
        }
        onQuoteChange(summary);
        inFlight.current = false;
        setQuoteLoading(false);
      },
    );
  }, [accountId, clearQuoteTimeout, onQuoteChange, options, requestIdentity, requestKind, requestPayload, txId, value]);

  useEffect(() => {
    if (previousRequestIdentity.current === requestIdentity) return;
    previousRequestIdentity.current = requestIdentity;
    resetQuoteState();
  }, [requestIdentity, resetQuoteState]);

  useEffect(() => {
    if (disabled || value === "native") cancelQuoteRequest();
  }, [cancelQuoteRequest, disabled, value]);

  useEffect(() => () => {
    quoteRequestSequence.current += 1;
    clearQuoteTimeout();
  }, [clearQuoteTimeout]);

  const isTokenPayment = value !== "native";
  useEffect(() => {
    if (
      !disabled && isTokenPayment && !quote && !quoteLoading && !quoteError &&
      !quoteRequestStarted.current && options.length > 0
    ) requestQuote();
  }, [disabled, isTokenPayment, options.length, quote, quoteError, quoteLoading, requestQuote]);

  useEffect(() => {
    if (disabled || !isTokenPayment || !quote?.quoteId || quote.tokenId !== value) return;
    const refreshAt = quote.expiresAt - REFRESH_BEFORE_EXPIRY_MS;
    const expiresAt = quote.expiresAt - EXPIRY_MARGIN_MS;
    const refreshTimer = !quoteError && refreshCount.current < AUTO_REFRESH_LIMIT &&
      refreshingQuoteId.current !== quote.quoteId
      ? window.setTimeout(() => requestQuote(value, true), Math.max(1, refreshAt - Date.now()))
      : null;
    const expiryTimer = window.setTimeout(() => {
      // Slow requests or a suspended tab must never leave an expired quote confirmable.
      onQuoteChange(null);
      if (!inFlight.current) {
        setQuoteError((error) => error || `${quote.tokenSymbol} gas quote expired`);
      }
    }, Math.max(1, expiresAt - Date.now()));
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [disabled, isTokenPayment, onQuoteChange, quote, quoteError, requestQuote, value]);

  return { quoteLoading, quoteError, requestQuote, resetQuoteState };
}
