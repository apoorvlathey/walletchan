/** External messages must not authorize execution by a wallet-owned account. */
export const INTERNAL_ACCOUNT_TYPED_DATA_ERROR =
  "External signature requests cannot use wallet accounts as the verifying contract. Use a reviewed transaction or permission request instead.";

export function usesInternalAccountDomain(
  domain: { verifyingContract?: unknown },
  protectedAddresses: readonly string[],
): boolean {
  const verifyingContract = domain.verifyingContract;
  return (
    typeof verifyingContract === "string" &&
    protectedAddresses.some(
      (address) => address.toLowerCase() === verifyingContract.toLowerCase(),
    )
  );
}
