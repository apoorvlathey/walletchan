import type { Account, AccountType } from "../types";

interface AccountTypeCapabilities {
  /** Signs with its own EOA authority, including delegated EOAs. */
  directSigner: boolean;
}

/**
 * Core account classification. Adding an AccountType requires an explicit row.
 * This does not grant feature, session, device, or transaction authorization.
 */
export const ACCOUNT_TYPE_CAPABILITIES = {
  bankr: { directSigner: true },
  privateKey: { directSigner: true },
  seedPhrase: { directSigner: true },
  ledger: { directSigner: true },
  impersonator: { directSigner: false },
  safe: { directSigner: false },
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
