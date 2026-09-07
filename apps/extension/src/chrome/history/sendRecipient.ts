import type { CompletedTransaction } from "./types";

export function normalizedSendAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[\da-f]{40}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

/** Only explicit Send history is a reference; receipt logs never establish intent. */
export function getRecordedSendRecipient(entry: CompletedTransaction): string | null {
  if (typeof entry.origin !== "string" || !entry.origin.startsWith("Send ") || entry.accountType === "impersonator"
    || entry.replacement?.kind === "cancel" || entry.swapMeta || entry.bridge
    || entry.parentBundleId || entry.safeExecutionMeta) return null;
  const to = normalizedSendAddress(entry.tx.to);
  if (!to) return null;

  // This metadata is authored by the sponsored-send coordinator, not a log.
  if (entry.origin === "Send USDC (Sponsored)" && entry.transferMeta) {
    return normalizedSendAddress(entry.transferMeta.recipient);
  }
  const data = entry.tx.data;
  if (data !== undefined) {
    if (data === "0x") return to;
    // Canonical transfer(address,uint256), including strict address padding.
    if (/^0xa9059cbb0{24}[\da-f]{104}$/i.test(data)) {
      return normalizedSendAddress(`0x${data.slice(34, 74)}`);
    }
    return null;
  }
  const recorded = normalizedSendAddress(entry.sendRecipient);
  if (recorded) return recorded;

  // Released compact rows can be recovered only from matching local snapshots.
  // Missing calldata alone does not establish a native send.
  const snapshot = entry.clearSignedMeta;
  if (snapshot?.kind === "transfer" && entry.calldataSelector === "0xa9059cbb"
    && normalizedSendAddress(snapshot.tokenAddress) === to) {
    return normalizedSendAddress(snapshot.counterparty);
  }
  if (snapshot?.kind === "nativeSend" && !entry.calldataSelector
    && normalizedSendAddress(snapshot.counterparty) === to) return to;
  return null;
}
