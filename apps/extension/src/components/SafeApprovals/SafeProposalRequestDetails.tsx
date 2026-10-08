import { CheckIcon } from "@chakra-ui/icons";
import { Badge, Box, Text, VStack } from "@chakra-ui/react";
import type {
  SafeChainSnapshot,
  SafeProposalRecord,
} from "@/chrome/safe/types";
import type { Account } from "@/chrome/types";
import { BatchCallsList } from "@/components/BatchCallsList";
import { SafeProposalSigners } from "./SafeProposalSigners";
import { makeSafeDisplayCalls } from "./safeProposalActionModel";
import { isSafeExecutionRpcWarning } from "@/chrome/safe/executionStatus";
import {
  getSafeProposalNoncePosition,
  isFutureSafeNonceError,
} from "@/chrome/safe/proposalNonce";

const STATE_LABELS: Record<SafeProposalRecord["state"], string> = {
  draft: "Needs approval",
  authorizing: "Authorizing",
  approvedLocally: "Approval saved",
  publishing: "Sharing approval",
  awaitingApprovals: "Waiting for owners",
  readyToExecute: "Ready to execute",
  executing: "Executing",
  executed: "Executed",
  cancelled: "Cancelled",
  ambiguous: "Confirming onchain",
  stale: "Stale",
  replaced: "Replaced",
  blocked: "Blocked",
  failed: "Failed",
};

function SuccessStatusPill({ label }: { label: string }) {
  return (
    <Badge
      variant="success"
      display="inline-flex"
      alignItems="center"
      gap={1}
      px={2}
      py={1}
      fontSize="xs"
      lineHeight="1.2"
    >
      <CheckIcon boxSize="10px" flexShrink={0} aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function SafeProposalStatusPill({
  proposal,
  liveNonce,
}: {
  proposal: Pick<SafeProposalRecord, "purpose" | "state" | "transaction" | "error">;
  liveNonce: `${bigint}`;
}) {
  const queued =
    getSafeProposalNoncePosition(proposal.transaction.nonce, liveNonce) === "future" ||
    (proposal.state === "blocked" && isFutureSafeNonceError(proposal.error));
  return queued ? (
    <Badge variant="warning">Queued</Badge>
  ) : proposal.state === "readyToExecute" || proposal.state === "executed" ? (
    <SuccessStatusPill
      label={proposal.state === "executed"
        ? "Executed"
        : proposal.purpose === "rejection"
          ? "Ready to reject"
          : "Ready to execute"}
    />
  ) : (
    <Badge variant={proposal.state === "draft" ? "warning" : undefined}>
      {STATE_LABELS[proposal.state]}
    </Badge>
  );
}

export function SafeProposalRequestDetails({
  proposal,
  snapshot,
  accounts,
  error,
  notice,
  simulationReverted,
  showRequestLifecycle,
}: {
  proposal: SafeProposalRecord;
  snapshot: SafeChainSnapshot;
  accounts: readonly Account[];
  error: string | null;
  notice: string | null;
  simulationReverted: boolean;
  showRequestLifecycle: boolean;
}) {
  const proposalError = !isFutureSafeNonceError(proposal.error) && (
    proposal.state === "failed" || (
    showRequestLifecycle &&
    proposal.state !== "executing" &&
    proposal.state !== "ambiguous"
    )
  )
    ? proposal.error
    : null;
  const rpcWarning = showRequestLifecycle && isSafeExecutionRpcWarning(proposal.error)
    ? proposal.error
    : null;

  return (
    <VStack spacing={3} align="stretch">
      {showRequestLifecycle && simulationReverted && (
        <Box bg="status.error.bg" border="1px solid" borderColor="status.error.border" borderRadius="lg" p={3}>
          <Text color="status.error.fg" fontSize="sm" fontWeight="700">
            Simulation reverted. Approval and execution are blocked until this proposal is replaced.
          </Text>
        </Box>
      )}
      {showRequestLifecycle && notice && (
        <Box bg="status.success.bg" border="1px solid" borderColor="status.success.border" borderRadius="lg" p={3}>
          <Text color="status.success.fg" fontSize="sm" fontWeight="700">{notice}</Text>
        </Box>
      )}
      {rpcWarning && (
        <Box
          role="status"
          aria-live="polite"
          bg="status.warning.bg"
          border="1px solid"
          borderColor="status.warning.border"
          borderRadius="lg"
          p={3}
        >
          <Text color="status.warning.fg" fontSize="sm" fontWeight="700">
            {rpcWarning}
          </Text>
        </Box>
      )}
      {(error || proposalError) && (
        <Box bg="status.error.bg" border="1px solid" borderColor="status.error.border" borderRadius="lg" p={3}>
          <Text color="status.error.fg" fontSize="sm" fontWeight="700">
            {error || proposalError}
          </Text>
        </Box>
      )}

      {proposal.purpose === "rejection" ? (
        <Box
          bg="surface.raised"
          border="1px solid"
          borderColor="border.default"
          borderRadius="lg"
          p={3}
        >
          <Text color="fg.primary" fontSize="md" fontWeight="600" lineHeight="short">
            Reject pending transaction #{proposal.transaction.nonce}
          </Text>
        </Box>
      ) : (
        <BatchCallsList calls={makeSafeDisplayCalls(proposal)} chainId={proposal.chainId} />
      )}

      {!showRequestLifecycle && (
        <SafeProposalSigners proposal={proposal} snapshot={snapshot} accounts={accounts} />
      )}
    </VStack>
  );
}
