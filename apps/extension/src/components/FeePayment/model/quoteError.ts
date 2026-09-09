/** Match the ABI error, not arbitrary occurrences of "expired" in provider prose. */
export function isTransactionSignatureExpired(error: string): boolean {
  return /(?:^|[^0-9a-f])0xcd21db4f[0-9a-f]{64}(?![0-9a-f])/iu.test(error) ||
    /\bSignatureExpired\s*\(/u.test(error);
}

export function feeQuoteErrorSummary(error: string, isSwap: boolean): string {
  if (isTransactionSignatureExpired(error)) {
    return isSwap
      ? "Swap signature expired. Refresh the swap and review it again."
      : "Transaction signature expired. Request a fresh transaction from the app.";
  }
  // Keep the provider's full diagnostic for Copy; avoid dumping ABI data in the footer.
  return error.replace(/0x[0-9a-f]{16,}/giu, "[revert data]");
}
