import { validateSiwePersonalSignRequest } from "@/lib/siwe";
import type { DirectSigningAccount } from "../accounts/accountTypePolicy";
import { validateExternalSignatureTypedData } from "./externalTypedData";
import {
  getPendingSignatureRequestById,
  removePendingSignatureRequest,
  type PendingSignatureRequest,
} from "../requests/pendingSignatureStorage";
import {
  resolvePinnedAccount,
  type SignatureResult,
} from "../transactions/runtime";
import { extractSignerParam } from "./requestSigner";

export type PreparedSignatureConfirmation = {
  pending: PendingSignatureRequest;
  account: DirectSigningAccount;
};

export type SignatureConfirmationPreflight =
  | { ok: true; value: PreparedSignatureConfirmation }
  | { ok: false; result: SignatureResult };

/**
 * Applies the shared, side-effect-ordered signature checks before either the
 * local, Ledger, or Bankr signer is selected.
 */
export async function prepareSignatureConfirmation(
  sigId: string,
  allowUnsafeSiwe = false,
): Promise<SignatureConfirmationPreflight> {
  const pending = await getPendingSignatureRequestById(sigId);
  if (!pending) {
    return {
      ok: false,
      result: { success: false, error: "Signature request not found" },
    };
  }

  const pinned = await resolvePinnedAccount(pending);
  if (!pinned.ok) {
    return { ok: false, result: { success: false, error: pinned.error } };
  }
  const account = pinned.account;

  if (account.type === "safe") {
    return {
      ok: false,
      result: {
        success: false,
        error: "Safe message signing is not supported yet",
      },
    };
  }

  const typedDataValidation = await validateExternalSignatureTypedData(
    pending.signature,
    account.address,
  );
  if (!typedDataValidation.valid) {
    await removePendingSignatureRequest(sigId);
    return {
      ok: false,
      result: {
        success: false,
        error: typedDataValidation.error,
      },
    };
  }
  if (typedDataValidation.sanitized) {
    pending.signature.params[1] = typedDataValidation.sanitized;
  }

  const signerParam = extractSignerParam(
    pending.signature.method,
    pending.signature.params,
  );
  if (
    typeof signerParam === "string" &&
    signerParam.toLowerCase() !== account.address.toLowerCase()
  ) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Signer address does not match active account",
      },
    };
  }

  if (!allowUnsafeSiwe) {
    const trustedOrigin = pending.senderOrigin ?? pending.origin;
    const validation = validateSiwePersonalSignRequest(
      pending.signature.method,
      pending.signature.params,
      {
        origin: trustedOrigin,
        signerAddress: account.address,
        connectedChainId: pending.signature.chainId,
      },
    );
    if (!validation.ok) {
      return {
        ok: false,
        result: { success: false, error: validation.error },
      };
    }
  }

  return { ok: true, value: { pending, account } };
}
