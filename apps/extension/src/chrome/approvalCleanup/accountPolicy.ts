export type ApprovalCleanupEoaAccountType =
  | "bankr"
  | "privateKey"
  | "seedPhrase"
  | "ledger"
  | "impersonator";

export function supportsAtomicEoaApprovalCleanup(
  accountType: unknown,
): accountType is "privateKey" | "seedPhrase" | "bankr" {
  return accountType === "privateKey" || accountType === "seedPhrase" || accountType === "bankr";
}
