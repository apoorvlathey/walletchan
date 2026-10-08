import { Button, VStack } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { PendingTxRequest } from "@/chrome/requests/pendingTxStorage";
import { isPendingSafeProposal } from "@/chrome/safe/proposalStatus";
import { isUncommittedSafeRejection } from "@/chrome/safe/proposalRejectionPolicy";
import type { SafeChainSnapshot, SafeProposalRecord } from "@/chrome/safe/types";
import type { Account, SafeAccount } from "@/chrome/types";
import type { GasOverrides } from "@/chrome/txHandlers";
import { SafeTransactionWarnings } from "@/components/SafeReview/SafeTransactionWarnings";
import { CopyButton } from "@/components/CopyButton";
import { LedgerSigningStatus } from "@/components/Ledger/LedgerSigningStatus";
import { EstimatedChangesHeading } from "@/components/RequestConfirmation/EstimatedChangesHeading";
import { RequestIdentity } from "@/components/RequestConfirmation/RequestIdentity";
import { SafeProposalPrimaryAction } from "./SafeProposalPrimaryAction";
import { useSafeSignAndExecute } from "./hooks/useSafeSignAndExecute";
import { shouldConfirmSimulationFailure } from "@/components/RequestConfirmation/simulationFailure";
import { ConfirmationScreen } from "@/components/ui";
import { useIconChipBg } from "@/theme";
import type { FeePaymentQuoteSummary } from "@/components/FeePaymentSelector";
import { SafeProposalAdvancedDetails } from "./SafeProposalAdvancedDetails";
import { SafeProposalSigners } from "./SafeProposalSigners";
import { SafeProposalDecisionSummary } from "./SafeProposalDecisionSummary";
import { SafeProposalFinancialImpact } from "./SafeProposalFinancialImpact";
import { useSafeExecutionRefresh } from "./hooks/useSafeExecutionRefresh";
import { useSafeProposalActions } from "./hooks/useSafeProposalActions";
import { createSafeApprovalCleanup } from "./approvalCleanupAdapter";
import { useSafeProposalReviewRefresh } from "./hooks/useSafeProposalReviewRefresh";
import { SafeRiskDecision } from "@/components/SafeReview/SafeRiskDecision";
import { useSafeRiskDecision } from "@/components/SafeReview/useSafeRiskDecision";
import {
  SafeProposalRequestDetails,
  SafeProposalStatusPill,
} from "./SafeProposalRequestDetails";
import {
  canRejectSafeProposal,
  getAvailableSafeOwnerAccounts,
  getDefaultSafeExecutorAccountId,
  getSafeExecutionBlockedReason,
  getSafeExecutorAccounts,
  getSafeOwnerAccounts,
  getSafeProposalActionKind,
  hasSafeProposalSignatures,
  makeSafeExecutionTxRequest,
  makeSafeReviewTxRequest,
} from "./safeProposalActionModel";

function originHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}
export function SafeProposalConfirmation({
  safeAccount,
  proposal,
  snapshot,
  accounts,
  chainName,
  explorer,
  backLabel = "Back to requests",
  onBack,
  onRejected = onBack,
  onOpenProposal,
  onReload,
  onExecutionSubmitted,
}: {
  safeAccount: SafeAccount;
  proposal: SafeProposalRecord;
  snapshot: SafeChainSnapshot;
  accounts: Account[];
  chainName: string;
  explorer?: string;
  backLabel?: string;
  onBack: () => void;
  onRejected?: () => void;
  onOpenProposal: (proposalId: string) => void;
  onReload: () => Promise<void>;
  onExecutionSubmitted: () => void;
}) {
  const iconChipBg = useIconChipBg();
  const [ownerAccountId, setOwnerAccountId] = useState<string | null>(null);
  const [executorAccountId, setExecutorAccountId] = useState<string | null>(null);
  const [gasOverrides, setGasOverrides] = useState<GasOverrides | null>(null);
  const [gasValid, setGasValid] = useState(false);
  const [gasLoading, setGasLoading] = useState(true);
  const [simulationLoading, setSimulationLoading] = useState(true);
  const [feePaymentToken, setFeePaymentToken] = useState<"native" | `0x${string}`>("native");
  const [feePaymentQuote, setFeePaymentQuote] = useState<FeePaymentQuoteSummary | null>(null);
  const [simulationReverted, setSimulationReverted] = useState(false);
  const [simulationUnavailable, setSimulationUnavailable] = useState(false);
  const [reviewFresh, setReviewFresh] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [submissionFooter, setSubmissionFooter] = useState({ canReject: false, requiresOnchainRejection: false });

  const ownerAccounts = useMemo(() => getSafeOwnerAccounts(accounts, snapshot), [accounts, snapshot]);
  const safeOwnerAccountIds = useMemo(
    () => new Set(ownerAccounts.map((account) => account.id)),
    [ownerAccounts],
  );
  const availableOwners = useMemo(
    () => getAvailableSafeOwnerAccounts(accounts, snapshot, proposal),
    [accounts, proposal, snapshot],
  );
  const executors = useMemo(() => getSafeExecutorAccounts(accounts, snapshot), [accounts, snapshot]);
  const selectedOwner = availableOwners.find((account) => account.id === ownerAccountId) ?? null;
  const { eligible: combinedEligible, combined, executionPreview, preparationError, selectOffchain, selectCombined } =
    useSafeSignAndExecute({ proposal, snapshot, owner: selectedOwner, chainName, reviewFresh, locked: submissionLocked });
  const actionKind = getSafeProposalActionKind(proposal, availableOwners, snapshot);
  const isRequestView = isPendingSafeProposal(proposal) || isUncommittedSafeRejection(proposal);
  const isRejection = proposal.purpose === "rejection";
  const requiresOnchainRejection = hasSafeProposalSignatures(proposal);
  const executionPending = ["ambiguous", "executing"].includes(proposal.state) &&
    (!!proposal.transactionHash || !!proposal.userOperationHash);
  useSafeExecutionRefresh({ pending: executionPending, proposalId: proposal.id, onReload });

  useEffect(() => {
    if (submissionLocked) return;
    if (!availableOwners.some((account) => account.id === ownerAccountId)) {
      setOwnerAccountId(availableOwners[0]?.id ?? null);
    }
  }, [availableOwners, ownerAccountId, submissionLocked]);

  useEffect(() => {
    if (!executors.some((account) => account.id === executorAccountId)) {
      setExecutorAccountId(getDefaultSafeExecutorAccountId(executors, snapshot));
    }
  }, [executorAccountId, executors, snapshot]);

  useEffect(() => {
    if (submissionLocked) return;
    setGasOverrides(null);
    setGasLoading(true);
    setSimulationLoading(true);
    setGasValid(actionKind !== "execute");
    setFeePaymentToken("native");
    setFeePaymentQuote(null);
  }, [actionKind, executorAccountId, proposal.id, submissionLocked, combined, ownerAccountId]);

  useSafeProposalReviewRefresh({
    isRequestView, proposal, safeAccountId: safeAccount.id, submissionLocked, onReload,
    setReviewFresh, setReviewError, setSimulationReverted, setSimulationUnavailable,
  });

  const reviewRequest = useMemo(
    () => makeSafeReviewTxRequest(proposal, chainName),
    [chainName, proposal],
  );
  const selectedExecutor = executors.find((account) => account.id === executorAccountId) ?? null;
  const {
    busy,
    error: actionError,
    handleConfirm,
    handleBack,
    handleNonceChange,
    handleReject,
    notice,
    operation,
    primaryActionKind,
    runAction,
  } = useSafeProposalActions({
    proposal,
    actionKind,
    selectedOwner,
    selectedExecutor,
    gasOverrides,
    feePaymentToken,
    feePaymentQuote,
    onRejected,
    onBack,
    onOpenProposal,
    onReload,
  });
  const error = actionError ?? reviewError;
  const displayRequestView = isRequestView || submissionLocked;
  const selectedAccount = primaryActionKind === "execute"
    ? selectedExecutor
    : (operation === "approve" || operation === "signAndExecute")
      ? ownerAccounts.find((account) => account.id === ownerAccountId) ?? null
      : selectedOwner;
  const isLedgerWaiting =
    selectedAccount?.type === "ledger" &&
    (operation === "approve" || operation === "execute" || operation === "signAndExecute");
  const actionAccounts = primaryActionKind === "execute"
    ? executors
    : (operation === "approve" || operation === "signAndExecute")
      ? ownerAccounts
      : availableOwners;
  const executionBlockedReason = primaryActionKind === "execute" ? getSafeExecutionBlockedReason(proposal, snapshot) : null;
  const executionRequest = useMemo<PendingTxRequest | null>(
    () => combined ? executionPreview : primaryActionKind === "execute" && selectedExecutor && !executionBlockedReason
      ? makeSafeExecutionTxRequest(proposal, chainName, selectedExecutor)
      : null,
    [chainName, executionBlockedReason, primaryActionKind, proposal, selectedExecutor, combined, executionPreview],
  );

  const safeRiskDecision = useSafeRiskDecision(
    { transaction: proposal.transaction, chainId: proposal.chainId },
    JSON.stringify([safeAccount.id, proposal.id, proposal.safeConfigEpoch,
      combined ? "signAndExecute" : primaryActionKind, selectedAccount?.id, selectedAccount?.address, selectedAccount?.type]),
  );
  const approvalCleanup = createSafeApprovalCleanup({
    proposal,
    busy: busy || submissionLocked || !reviewFresh,
    onReload,
    onOpenProposal,
  });
  const canReject = canRejectSafeProposal(proposal);
  const footerCanReject = submissionLocked ? submissionFooter.canReject : canReject;
  const footerRequiresOnchainRejection = submissionLocked ? submissionFooter.requiresOnchainRejection : requiresOnchainRejection;
  const preparingCombined = combined && !preparationError &&
    (!reviewFresh || !executionPreview || gasLoading || (!isRejection && simulationLoading));
  const disabledReason = safeRiskDecision.blocked
    ? "Acknowledge the Safe transaction warnings"
    : !reviewFresh
    ? "Refreshing Safe authority"
    : combined && !executionPreview
      ? preparationError ?? "Preparing execution fee"
    : combined && !isRejection && simulationLoading
      ? "Simulating execution"
    : executionBlockedReason
      ? executionBlockedReason
      : !selectedAccount
        ? primaryActionKind === "execute" ? "No local execution account is available" : "No available Safe owner is linked"
      : (combined || primaryActionKind === "execute") && feePaymentToken === "native" && (!gasValid || !gasOverrides)
          ? "Set a valid network fee"
        : primaryActionKind === "execute" && feePaymentToken !== "native" && !feePaymentQuote?.quoteId
          ? "Choose a current fee-token quote"
          : null;
  const primaryAction = !displayRequestView ? undefined : primaryActionKind || submissionLocked ? (
    <SafeProposalPrimaryAction
      isPreparing={preparingCombined}
      eligible={combinedEligible} combined={combined}
      hideDropdown={submissionLocked}
      acknowledgementRequired={safeRiskDecision.blocked} disabledReason={disabledReason}
      isLoading={submissionLocked || operation === "approve" || operation === "execute" || operation === "signAndExecute"}
      label={isRejection ? primaryActionKind === "execute" ? "Execute rejection" : "Sign rejection" : primaryActionKind === "execute" ? "Execute" : "Sign offchain"}
      onConfirm={() => void (async () => {
        if (submissionLocked || safeRiskDecision.blocked || disabledReason) return;
        const executing = combined || primaryActionKind === "execute";
        if (executing) {
          setSubmissionFooter({ canReject, requiresOnchainRejection });
          setSubmissionLocked(true);
        }
        const submitted = await handleConfirm({ allowSimulationFailure: simulationReverted, signAndExecute: combined });
        if (executing && submitted) onExecutionSubmitted();
        else if (executing) setSubmissionLocked(false);
      })()}
      onOffchain={selectOffchain} onCombined={selectCombined}
      requestKind={proposal.calls.length > 1 ? "batch" : "transaction"}
      simulationFailed={shouldConfirmSimulationFailure({ simulationReverted })}
    />
  ) : executionPending ? (
    <Button variant="brand" isDisabled>
      Confirming onchain…
    </Button>
  ) : proposal.state === "ambiguous" ? (
    <Button
      variant="secondary"
      isLoading={busy}
      onClick={() => void runAction({
        type: "reconcileSafeProposal",
        proposalId: proposal.id,
      }, "Approval status refreshed.")}
    >
      Retry approval sync
    </Button>
  ) : (
    <Button variant="secondary" onClick={() => void handleBack()}>{backLabel}</Button>
  );

  return (
    <ConfirmationScreen
      title={displayRequestView
        ? isRejection ? "Reject transaction" : "Transaction request"
        : "Transaction details"}
      onBack={() => void handleBack()}
      trailing={(
        <CopyButton
          label="Copy Safe transaction JSON"
          value={JSON.stringify(proposal.calls.map((call) => ({
            to: call.to,
            value: call.value,
            data: call.data,
          })), null, 2)}
        />
      )}
      outcome={(
        <RequestIdentity
          origin={reviewRequest.origin}
          originHostname={originHostname(reviewRequest.origin)}
          favicon={reviewRequest.favicon}
          iconChipBg={iconChipBg}
          isInternalWalletChan={reviewRequest.origin === "WalletChan"}
          originInitials="SAFE"
        />
      )}
      financialImpact={displayRequestView ? (
        <SafeProposalFinancialImpact
          proposal={proposal}
          reviewRequest={reviewRequest}
          executionRequest={executionRequest}
          simulationEnabled={reviewFresh && (!combined || !!executionRequest)}
          onSimulationLoadingChange={setSimulationLoading}
          preparationError={preparationError}
          approvalCleanup={approvalCleanup}
          onRevertedChange={setSimulationReverted}
          onUnavailableChange={setSimulationUnavailable}
        />
      ) : undefined}
      financialImpactTitle={displayRequestView ? (
        <EstimatedChangesHeading chainId={proposal.chainId} chainName={chainName} />
      ) : undefined}
      context={(
        <SafeTransactionWarnings transaction={proposal.transaction} chainId={proposal.chainId} hideWarnings={displayRequestView}>
          <SafeProposalRequestDetails
            proposal={proposal}
            snapshot={snapshot}
            accounts={ownerAccounts}
            error={error}
            notice={notice}
            simulationReverted={simulationReverted}
            showRequestLifecycle={displayRequestView}
          />
          <LedgerSigningStatus active={isLedgerWaiting} />
        </SafeTransactionWarnings>
      )}
      contextTitle={displayRequestView ? "Request details" : "Safe transaction"}
      contextHeaderAction={<SafeProposalStatusPill proposal={proposal} liveNonce={snapshot.nonce} />}
      advancedDetails={(
        <SafeProposalAdvancedDetails
          proposal={proposal}
          explorer={explorer}
          busy={busy}
          readOnly={!displayRequestView}
          minimumNonce={snapshot.nonce}
          onNonceChange={handleNonceChange}
          onAction={(message, successNotice) => void runAction(message, successNotice)}
        />
      )}
      actionSummary={displayRequestView ? (
        <VStack align="stretch" spacing={3}>
          <SafeProposalSigners key={proposal.id} proposal={proposal} snapshot={snapshot} accounts={ownerAccounts} compact />
          <SafeProposalDecisionSummary
            chainId={proposal.chainId}
            actionKind={combined ? "execute" : primaryActionKind}
            signAndExecute={combined}
            accounts={actionAccounts}
            selectedAccount={selectedAccount}
            safeOwnerAccountIds={safeOwnerAccountIds}
            executionRequest={executionRequest}
            proposalId={proposal.id}
            onSelect={(accountId) => {
              if (!combined && primaryActionKind === "execute") setExecutorAccountId(accountId);
              else setOwnerAccountId(accountId);
            }}
            onGasOverrides={setGasOverrides}
            onGasValidityChange={setGasValid}
            onGasLoadingChange={setGasLoading}
            feePaymentToken={feePaymentToken}
            feePaymentQuote={feePaymentQuote}
            onFeePaymentTokenChange={(token) => {
              setFeePaymentToken(token);
              setFeePaymentQuote(null);
              if (token !== "native") {
                setGasOverrides(null);
                setGasValid(true);
              }
            }}
            onFeePaymentQuoteChange={setFeePaymentQuote}
            disabled={submissionLocked || isLedgerWaiting}
          />
        </VStack>
      ) : undefined}
      actionNotice={displayRequestView ? <>
        <SafeRiskDecision decision={safeRiskDecision} isDisabled={busy || submissionLocked} />
        {executionBlockedReason ?? (simulationUnavailable
          ? "Simulation is unavailable. Review the call details carefully." : undefined)}
      </> : undefined}
      confirmAction={primaryAction}
      rejectAction={displayRequestView && footerCanReject ? (
        <Button
          variant={footerRequiresOnchainRejection ? "danger" : "secondary"}
          isLoading={operation === "reject"}
          isDisabled={submissionLocked || isLedgerWaiting}
          onClick={() => void handleReject()}
        >
          {footerRequiresOnchainRejection ? "Reject onchain" : "Reject"}
        </Button>
      ) : undefined}
    />
  );
}
