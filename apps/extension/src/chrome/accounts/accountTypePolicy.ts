import type { Account, AccountType } from "../types";

interface AccountTypeCapabilities {
  /** Signs with its own EOA authority, including delegated EOAs. */
  directSigner: boolean;
  /** Explicit execution transport; raw signers must also implement the dispatch table. */
  forceInclusion: "raw" | "bankr" | false;
  /** Batch deposits are a separate execution path, currently OP Stack only. */
  forceInclusionBatch: boolean;
}

/**
 * Core account classification. Adding an AccountType requires an explicit row.
 * This does not grant feature, session, device, or transaction authorization.
 */
export const ACCOUNT_TYPE_CAPABILITIES = {
  bankr: { directSigner: true, forceInclusion: "bankr", forceInclusionBatch: true },
  privateKey: { directSigner: true, forceInclusion: "raw", forceInclusionBatch: true },
  seedPhrase: { directSigner: true, forceInclusion: "raw", forceInclusionBatch: true },
  ledger: { directSigner: true, forceInclusion: "raw", forceInclusionBatch: false },
  impersonator: { directSigner: false, forceInclusion: false, forceInclusionBatch: false },
  safe: { directSigner: false, forceInclusion: false, forceInclusionBatch: false },
} as const satisfies Record<AccountType, AccountTypeCapabilities>;

export type DirectSigningAccountType = {
  [Type in AccountType]:
    (typeof ACCOUNT_TYPE_CAPABILITIES)[Type]["directSigner"] extends true
      ? Type
      : never;
}[AccountType];

export type DirectSigningAccount = Extract<Account, { type: DirectSigningAccountType }>;

export function isDirectSigningAccountType(value: unknown): value is DirectSigningAccountType {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ACCOUNT_TYPE_CAPABILITIES, value) &&
    ACCOUNT_TYPE_CAPABILITIES[value as AccountType].directSigner;
}

export function isDirectSigningAccount(account: Account | null): account is DirectSigningAccount {
  return !!account && isDirectSigningAccountType(account.type);
}

export type RawForceInclusionAccountType = {
  [Type in AccountType]:
    (typeof ACCOUNT_TYPE_CAPABILITIES)[Type]["forceInclusion"] extends "raw"
      ? Type : never;
}[AccountType];
export type RawForceInclusionAccount = Extract<Account, { type: RawForceInclusionAccountType }>;

export function isRawForceInclusionAccount(account: Account | null): account is RawForceInclusionAccount {
  return isDirectSigningAccount(account) && ACCOUNT_TYPE_CAPABILITIES[account.type].forceInclusion === "raw";
}
