import { useEffect, useRef, useState } from "react";
import type { SafeChainSnapshot, SafeProposalRecord } from "@/chrome/safe/types";
import type { PendingTxRequest } from "@/chrome/requests/pendingTxStorage";
import type { SafeOwnerAccount } from "@/chrome/safe/accountTypePolicy";
import { canSafeOwnerSignAndExecute } from "@/chrome/safe/signAndExecutePolicy";
import { sendSafeProposalMessage } from "../safeProposalTransport";

export function useSafeSignAndExecute({ proposal, snapshot, owner, chainName, reviewFresh, locked }: {
  proposal: SafeProposalRecord; snapshot: SafeChainSnapshot; owner: SafeOwnerAccount | null;
  chainName: string; reviewFresh: boolean; locked: boolean;
}) {
  const eligibility = useRef(false);
  const pinnedOwner = useRef(owner);
  if (!locked) {
    eligibility.current = canSafeOwnerSignAndExecute(proposal, snapshot, owner);
    pinnedOwner.current = owner;
  }
  const actor = pinnedOwner.current;
  const eligible = eligibility.current;
  const scope = `${proposal.id}:${actor?.id}:${proposal.safeConfigEpoch}`;
  const [offchainScope, setOffchainScope] = useState<string | null>(null);
  const combined = eligible && offchainScope !== scope;
  const [preview, setPreview] = useState<{ scope: string; request: PendingTxRequest } | null>(null);
  const [failure, setFailure] = useState<{ scope: string; error: string } | null>(null);

  useEffect(() => {
    if (locked || !combined || !reviewFresh || !actor) return;
    let active = true;
    setPreview(null);
    setFailure(null);
    void sendSafeProposalMessage<{ success: boolean; result?: { data: `0x${string}`; gas: string }; error?: string }>({
      type: "prepareSafeSignAndExecute", proposalId: proposal.id, ownerAccountId: actor.id,
    }).then((response) => {
      if (!response.success || !response.result) throw new Error(response.error || "Could not prepare execution fee");
      if (active) setPreview({ scope, request: {
        id: `safe-sign-execute:${scope}`,
        tx: { from: actor.address, to: proposal.safeAddress, value: "0", data: response.result.data, gas: response.result.gas, chainId: proposal.chainId },
        accountId: actor.id, accountAddress: actor.address, accountType: actor.type,
        origin: "WalletChan", favicon: null, chainName, timestamp: proposal.createdAt, trustedInternal: true,
      } });
    }).catch((error) => {
      if (active) setFailure({ scope, error: error instanceof Error ? error.message : "Could not prepare execution fee" });
    });
    return () => { active = false; };
    // The immutable review/actor scope owns preparation; same-proposal writes do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, combined, reviewFresh, locked]);

  return {
    eligible, combined,
    executionPreview: combined && preview?.scope === scope ? preview.request : null,
    preparationError: combined && failure?.scope === scope ? failure.error : null,
    selectOffchain: () => setOffchainScope(scope), selectCombined: () => setOffchainScope(null),
  };
}
