import type { SafeProposalRecord } from "@/chrome/safe/types";

export function sortSafeProposalsByNonceDescending(
  proposals: SafeProposalRecord[],
): SafeProposalRecord[] {
  return [...proposals].sort((a, b) =>
    b.transaction.nonce - a.transaction.nonce ||
    b.createdAt - a.createdAt ||
    b.updatedAt - a.updatedAt ||
    a.chainId - b.chainId ||
    a.id.localeCompare(b.id));
}

export function groupSafeProposalsByNonce(proposals: SafeProposalRecord[]) {
  const groups = new Map<string, { key: string; nonce: number; chainId: number; proposals: SafeProposalRecord[] }>();
  for (const proposal of sortSafeProposalsByNonceDescending(proposals)) {
    const key = `${proposal.chainId}:${proposal.safeAddress.toLowerCase()}:${proposal.transaction.nonce}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, nonce: proposal.transaction.nonce, chainId: proposal.chainId, proposals: [] };
      groups.set(key, group);
    }
    group.proposals.push(proposal);
  }
  return [...groups.values()];
}
