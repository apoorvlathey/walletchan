import { getAccounts } from "../accountStorage";
import { validateEIP712TypedData, type EIP712ValidationResult } from "../eip712Validator";
import type { SignatureParams } from "../requests/pendingSignatureStorage";
import { isDirectSigningAccount } from "../accounts/accountTypePolicy";

/** Dapp signature boundaries only; internal execution signers do not use this. */
export async function validateExternalSignatureTypedData(
  signature: SignatureParams,
  signerAddress: string,
): Promise<EIP712ValidationResult> {
  // Apply current intake rules to requests persisted by older builds as well.
  // Local/remote signing primitives historically accept the unversioned alias.
  if (signature.method === "eth_signTypedData") {
    return { valid: false, error: "eth_signTypedData (v1) is deprecated; please use eth_signTypedData_v4" };
  }
  if (signature.method === "eth_sign") {
    return { valid: false, error: "eth_sign is deprecated and unsafe; use personal_sign or eth_signTypedData_v4" };
  }
  if (
    signature.method !== "eth_signTypedData_v3" &&
    signature.method !== "eth_signTypedData_v4"
  ) return { valid: true };

  // Match MetaMask's EOA-only protected list. Imported Safes are legitimate
  // verifying contracts for owner signatures, not direct signing accounts.
  // Imported EOAs retain their authority regardless of local delegation settings.
  const accounts = await getAccounts();
  return validateEIP712TypedData(signature.method, signature.params?.[1], [
    signerAddress,
    ...accounts.filter(isDirectSigningAccount).map((account) => account.address),
  ]);
}
