import type { SafeProposalRecord } from "@/chrome/safe/types";
import { getPendingSafeRequests } from "@/chrome/safe/proposalStatus";
import type { Account, SafeAccount } from "@/chrome/types";

/** Restore local dapp reviews only; imported proposals remain in the Home inbox. */
export async function loadInitialSafeProposals(): Promise<SafeProposalRecord[]> {
  const response = await chrome.runtime.sendMessage({ type: "getSafeProposals" });
  if (!response?.success || !Array.isArray(response.result)) return [];
  return getPendingSafeRequests(response.result as SafeProposalRecord[])
    .filter((proposal) => !proposal.route.detachedAt &&
      (proposal.route.kind === "injected" || proposal.route.kind === "walletConnect" || proposal.route.kind === "erc5792"))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Pin the review surface to the proposal account, not the current tab's EOA. */
export async function getSafeRequestAccount(proposalId: string): Promise<SafeAccount | null> {
  const [response, accounts] = await Promise.all([
    chrome.runtime.sendMessage({ type: "getSafeProposal", proposalId }),
    chrome.runtime.sendMessage({ type: "getAccounts" }),
  ]);
  if (!response?.success || !response.result) return null;
  return (accounts as Account[]).find((account): account is SafeAccount =>
    account.type === "safe" && account.id === response.result.safeAccountId,
  ) ?? null;
}
