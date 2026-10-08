import { useEffect, useState } from "react";
import { getPendingSafeRequests } from "@/chrome/safe/proposalStatus";
import type { SafeProposalRecord } from "@/chrome/safe/types";

export function usePendingSafeProposalCount(safeAccountId?: string): number {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    let loadRevision = 0;
    const applyRecords = (records: SafeProposalRecord[], revision: number) => {
      if (!active || revision !== loadRevision) return;
      setPendingCount(getPendingSafeRequests(records).filter((proposal) =>
        !safeAccountId || proposal.safeAccountId === safeAccountId
      ).length);
    };
    const load = () => {
      const revision = ++loadRevision;
      chrome.runtime.sendMessage(
        { type: "getSafeProposals" },
        (response) => {
          if (!active || chrome.runtime.lastError) return;
          const records = response?.success && Array.isArray(response.result)
            ? response.result as SafeProposalRecord[]
            : [];
          applyRecords(records, revision);
        },
      );
    };

    load();
    if (safeAccountId) {
      chrome.runtime.sendMessage(
        { type: "syncSafeRequests", accountId: safeAccountId },
        (response) => {
          if (
            !active ||
            chrome.runtime.lastError ||
            !response?.success ||
            !Array.isArray(response.result)
          ) return;
          // A service sync response may predate a concurrent local submission.
          load();
        },
      );
    }

    const listener = (message: { type?: string }) => {
      if (message.type === "safeProposalsUpdated") load();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      active = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [safeAccountId]);

  return pendingCount;
}
