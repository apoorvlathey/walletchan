import type { SafeProposalRecord, SafeProposalState } from "./types";
import { isUncommittedSafeRejection } from "./proposalRejectionPolicy";

const PENDING_BY_STATE: Record<SafeProposalState, boolean> = {
  draft: true,
  authorizing: true,
  approvedLocally: true,
  publishing: true,
  awaitingApprovals: true,
  readyToExecute: true,
  executing: true,
  ambiguous: true,
  stale: true,
  blocked: true,
  executed: false,
  cancelled: false,
  replaced: false,
  failed: false,
};

/**
 * Unresolved proposal state for review and receipt reconciliation, including
 * blocked or stale proposals. Counts and inboxes use getPendingSafeRequests
 * to additionally exclude nonce slots already crossing the execution boundary.
 */
export function isPendingSafeProposal(
  proposal: Pick<SafeProposalRecord, "state" | "hiddenAt"> &
    Partial<SafeProposalRecord>,
): boolean {
  return !proposal.hiddenAt && !isUncommittedSafeRejection(proposal) && PENDING_BY_STATE[proposal.state];
}

/** Submitted or consumed nonce slots never reappear while settlement finishes. */
export function getPendingSafeRequests(proposals: readonly SafeProposalRecord[]): SafeProposalRecord[] {
  const nonceKey = (proposal: SafeProposalRecord) =>
    `${proposal.chainId}:${proposal.safeAddress.toLowerCase()}:${proposal.transaction.nonce}`;
  const submittedNonces = new Set(proposals.filter((proposal) =>
    proposal.state === "executed" ||
    ((proposal.state === "executing" || proposal.state === "ambiguous" || proposal.state === "replaced") &&
      (!!proposal.transactionHash || !!proposal.userOperationHash)),
  ).map(nonceKey));
  return proposals.filter((proposal) =>
    isPendingSafeProposal(proposal) && !submittedNonces.has(nonceKey(proposal)),
  );
}
