import type { FeePaymentOption } from "@/chrome/feePayment/capabilities";
import type { FeePaymentTokenId } from "@/chrome/feePayment/tokens";

/** Catalog order is deterministic; unknown balances must never trigger spending. */
export function automaticFeeToken(
  options: readonly FeePaymentOption[],
  nativeInsufficient: boolean,
  disabled: boolean,
): FeePaymentTokenId | null {
  if (!nativeInsufficient || disabled) return null;
  return options.find((option) => {
    if (option.id === "native" || !option.available || !option.balance) return false;
    try {
      return BigInt(option.balance) > 0n;
    } catch {
      return false;
    }
  })?.id ?? null;
}
