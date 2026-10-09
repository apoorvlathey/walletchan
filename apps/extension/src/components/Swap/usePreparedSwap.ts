import { useRef, useState } from "react";
import { formatUnits } from "viem";
import { useSwapPriceImpactDecision } from "./useSwapPriceImpactDecision";
import type { GasEstimate } from "@/chrome/gasEstimation";
import type { PortfolioToken } from "@/chrome/portfolio/api";
import type { SwapQuoteResponse, TokenInfo } from "@/chrome/swapApi";
import { useThemedToast } from "@/hooks/useThemedToast";
import type { PreparedSwapTxEntry } from "./swapViewTypes";
import { executePreparedSwap } from "./executePreparedSwap";
import { prepareBridgeSwap } from "./prepareBridgeSwap";
import { prepareSameChainSwap } from "./prepareSameChainSwap";
import { createSafeSwapProposal } from "./safeSwapProposal";
import { getSwapSubmissionKind } from "./swapSubmissionModel";
import type {
  PreparedAccountLock,
  PreparedDelegation,
  SwapAccountType,
} from "./swapViewTypes";

interface UsePreparedSwapOptions {
  sellToken: PortfolioToken | null;
  buyTokenInfo: TokenInfo | null;
  buyTokenAddress: string;
  buyTokenLogoURI?: string;
  buyTokenPriceUsd: number;
  sellTokenAmount: string;
  quote: SwapQuoteResponse | null;
  isBridge: boolean;
  fromAddress: string;
  accountId?: string;
  accountType: SwapAccountType;
  sellChainId: number;
  buyChainId: number;
  chainName: string;
  resolvedBuyChainName: string;
  slippageBps: number;
  onSwapInitiated: () => void;
  onSafeProposalCreated?: (proposalId: string) => void;
}

export function usePreparedSwap(options: UsePreparedSwapOptions) {
  const toast = useThemedToast();
  const submittingRef = useRef(false);
  const activeRequestRef = useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [preparedTransactions, setPreparedTransactions] = useState<
    PreparedSwapTxEntry[] | null
  >(null);
  const [preparedBatchTx, setPreparedBatchTx] = useState<{
    to: string;
    data: string;
    value: string;
  } | null>(null);
  const [preparedAccountLock, setPreparedAccountLock] =
    useState<PreparedAccountLock | null>(null);
  const [prepared7702, setPrepared7702] =
    useState<PreparedDelegation | null>(null);
  const [preparedQuote, setPreparedQuote] =
    useState<SwapQuoteResponse | null>(null);
  const [preparedRequestId, setPreparedRequestId] = useState<string | null>(null);
  const [swapGasEstimates, setSwapGasEstimates] =
    useState<GasEstimate[] | null>(null);
  const [swapGasValid, setSwapGasValid] = useState(true);

  const preparedSellAmount = preparedQuote && options.sellToken
    ? formatUnits(BigInt(preparedQuote.sellAmount), options.sellToken.decimals)
    : "0";
  const preparedSellUsd = Number(preparedSellAmount) * (options.sellToken?.priceUsd ?? 0);
  const impactReview = useSwapPriceImpactDecision({
    inputUsd: preparedSellUsd,
    outputAmount: preparedQuote?.buyAmount,
    buyTokenDecimals: options.buyTokenInfo?.decimals,
    buyTokenPriceUsd: options.buyTokenPriceUsd,
    quoteLoading: false,
    reviewContext: [preparedRequestId, preparedQuote, options.accountId,
      options.accountType, options.fromAddress, options.sellChainId, options.buyChainId],
  });
  const impactBlockedRef = useRef(impactReview.decision.blocked);
  impactBlockedRef.current = impactReview.decision.blocked;

  const stagePlan = async () => {
    if (submittingRef.current) return;
    const { sellToken, buyTokenInfo } = options;
    if (!sellToken || !buyTokenInfo) return;
    const submissionKind = getSwapSubmissionKind(
      options.accountType,
      options.isBridge,
    );
    if (submissionKind === "unsupported") {
      toast({
        title:
          options.accountType === "safe"
            ? "Safe bridge unavailable"
            : options.accountType === "ledger"
              ? "Ledger swap not available"
            : "View-only account",
        description:
          options.accountType === "safe"
            ? "Safe swaps currently stay on one network."
            : options.accountType === "ledger"
              ? "Use a swap dapp; WalletChan will show the normal Ledger confirmation."
            : "Impersonator accounts cannot send transactions",
        status: options.accountType === "ledger" ? "info" : "error",
        duration: options.accountType === "ledger" ? 4000 : 3000,
      });
      return;
    }
    if (!options.isBridge && !options.quote) return;

    submittingRef.current = true;
    activeRequestRef.current = null;
    setIsSubmitting(true);
    try {
      const common = {
        sellToken,
        buyTokenInfo,
        buyTokenAddress: options.buyTokenAddress,
        buyTokenLogoURI: options.buyTokenLogoURI,
        sellTokenAmount: options.sellTokenAmount,
        fromAddress: options.fromAddress,
        accountId: options.accountId,
        accountType: options.accountType,
        slippageBps: options.slippageBps,
        toast,
      };
      const plan = options.isBridge
        ? await prepareBridgeSwap({
            ...common,
            sellChainId: options.sellChainId,
            buyChainId: options.buyChainId,
            resolvedBuyChainName: options.resolvedBuyChainName,
          })
        : await prepareSameChainSwap({
            ...common,
            indicativeQuote: options.quote!,
            chainId: options.sellChainId,
          });
      if (!plan) {
        setShowConfirmation(false);
        return;
      }

      setSwapGasEstimates(null);
      setSwapGasValid(true);
      setPreparedTransactions(plan.transactions);
      setPreparedBatchTx(plan.batchTx);
      setPreparedAccountLock(
        options.accountId
          ? { accountId: options.accountId, fromAddress: options.fromAddress }
          : null,
      );
      setPrepared7702(plan.delegation);
      setPreparedQuote(plan.quote);
      const requestId = crypto.randomUUID();
      activeRequestRef.current = requestId;
      setPreparedRequestId(requestId);
      setShowConfirmation(true);
    } catch (error) {
      setShowConfirmation(false);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Swap failed",
        status: "error",
        duration: 3000,
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const confirm = async (
    feePaymentToken: "native" | `0x${string}`,
    feePaymentQuoteId: string | null,
  ) => {
    if (submittingRef.current || !preparedTransactions?.length || !preparedRequestId ||
      activeRequestRef.current !== preparedRequestId || impactBlockedRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (getSwapSubmissionKind(options.accountType, options.isBridge) === "safeProposal") {
        if (!preparedAccountLock || !options.onSafeProposalCreated) {
          throw new Error("Safe swap request routing is unavailable");
        }
        const proposalId = await createSafeSwapProposal({
          safeAccountId: preparedAccountLock.accountId,
          chainId: preparedTransactions[0].tx.chainId,
          transactions: preparedTransactions,
        });
        activeRequestRef.current = null;
        options.onSafeProposalCreated(proposalId);
        return;
      }

      const succeeded = await executePreparedSwap({
        transactions: preparedTransactions,
        batchTx: preparedBatchTx,
        delegation: prepared7702,
        accountLock: preparedAccountLock,
        gasEstimates: swapGasEstimates,
        feePaymentRequestId: preparedRequestId,
        feePaymentToken: feePaymentToken === "native" ? "native" : "token",
        feePaymentQuoteId,
        chainId: options.sellChainId,
        chainName: options.chainName,
        toast,
      });
      if (succeeded) {
        activeRequestRef.current = null;
        options.onSwapInitiated();
      }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Swap failed",
        status: "error", duration: 3000 });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const cancel = () => {
    activeRequestRef.current = null;
    setShowConfirmation(false);
    setPreparedTransactions(null);
    setPreparedBatchTx(null);
    setPreparedAccountLock(null);
    setPrepared7702(null);
    setPreparedQuote(null);
    setPreparedRequestId(null);
    setSwapGasEstimates(null);
    setSwapGasValid(true);
  };

  return {
    isSubmitting,
    showConfirmation,
    preparedTransactions,
    preparedBatchTx,
    prepared7702,
    preparedQuote,
    preparedSellAmount,
    preparedSellUsd,
    impactReview,
    preparedRequestId,
    swapGasValid,
    setSwapGasEstimates,
    setSwapGasValid,
    stagePlan,
    confirm,
    cancel,
  };
}
