import type { Account } from "../types";
import { isSafeExecutorAccount, isSafeOwnerAccount, type SafeExecutorAccount } from "./accountTypePolicy";
import type { SafeChainSnapshot, SafeProposalRecord } from "./types";

/** Only an unsigned final owner who can pay native execution gas is eligible. */
export function canSafeOwnerSignAndExecute(
  proposal: SafeProposalRecord,
  snapshot: SafeChainSnapshot,
  account: Account | null,
): account is SafeExecutorAccount {
  if (snapshot.blockedReason || !account || !isSafeOwnerAccount(account) || !isSafeExecutorAccount(account)) return false;
  const owner = account.address.toLowerCase() as `0x${string}`;
  const signed = new Set(proposal.confirmations.map((item) => item.ownerAddress));
  return ["draft", "approvedLocally", "awaitingApprovals"].includes(proposal.state) &&
    !proposal.effectClaim && !proposal.transactionHash && !proposal.userOperationHash &&
    !proposal.serializedExecution && proposal.purpose !== "rejection" &&
    proposal.safeConfigEpoch === snapshot.configEpoch &&
    BigInt(proposal.transaction.nonce) === BigInt(snapshot.nonce) &&
    snapshot.owners.includes(owner) && !signed.has(owner) &&
    signed.size === proposal.confirmations.length && signed.size + 1 === snapshot.threshold &&
    [...signed].every((address) => snapshot.owners.includes(address));
}
