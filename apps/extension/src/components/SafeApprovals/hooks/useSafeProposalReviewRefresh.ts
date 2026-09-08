import { useEffect } from "react";
import type { SafeChainSnapshot, SafeProposalRecord } from "@/chrome/safe/types";
import { sendSafeProposalMessage } from "../safeProposalTransport";

/** Refresh authority once per immutable proposal review, not on reconciliation writes. */
export function useSafeProposalReviewRefresh({
  isRequestView, proposal, safeAccountId, submissionLocked, onReload,
  setReviewFresh, setReviewError, setSimulationReverted, setSimulationUnavailable,
}: {
  isRequestView: boolean;
  proposal: SafeProposalRecord;
  safeAccountId: string;
  submissionLocked: boolean;
  onReload: () => Promise<void>;
  setReviewFresh: (fresh: boolean) => void;
  setReviewError: (error: string | null) => void;
  setSimulationReverted: (reverted: boolean) => void;
  setSimulationUnavailable: (unavailable: boolean) => void;
}) {
  useEffect(() => {
    if (submissionLocked) return;
    if (!isRequestView) {
      setReviewFresh(true);
      setReviewError(null);
      setSimulationReverted(false);
      setSimulationUnavailable(false);
      return;
    }
    let active = true;
    setReviewFresh(false);
    setSimulationReverted(false);
    setSimulationUnavailable(false);
    setReviewError(null);
    void (async () => {
      try {
        const refreshed = await sendSafeProposalMessage<{
          success?: boolean;
          record?: { chains: Record<string, SafeChainSnapshot> };
          error?: string;
        }>({
          type: "refreshSafeAccount",
          accountId: safeAccountId,
          chainId: proposal.chainId,
        });
        if (refreshed.success === false || !refreshed.record) {
          throw new Error(refreshed.error || "Could not refresh Safe authority");
        }
        const live = refreshed.record.chains[String(proposal.chainId)];
        if (!live || live.configEpoch !== proposal.safeConfigEpoch) {
          throw new Error("Safe configuration changed; review this request again");
        }
        if (["publishing", "awaitingApprovals", "readyToExecute"].includes(proposal.state)) {
          await sendSafeProposalMessage({
            type: "reconcileSafeProposal",
            proposalId: proposal.id,
          }).catch(() => undefined);
        }
        if (active) {
          await onReload();
          setReviewFresh(true);
        }
      } catch (caught) {
        if (active) {
          setReviewError(caught instanceof Error ? caught.message : "Could not refresh Safe request");
        }
      }
    })();
    return () => { active = false; };
    // The immutable proposal ID and request/detail mode are the review
    // boundary. Reconciliation writes within one pending state must not
    // restart the authority refresh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRequestView, proposal.id, submissionLocked]);
}
