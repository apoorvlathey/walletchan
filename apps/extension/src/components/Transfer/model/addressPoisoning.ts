import type { SendRecipientReference } from "@/chrome/history/sendRecipientReferences";

export interface AddressPoisoningMatch extends SendRecipientReference {
  prefixLength: number;
  suffixLength: number;
}

const validAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[\da-f]{40}$/i.test(value);

/** Exact addresses and checksum case differences are not lookalikes. */
export function findAddressPoisoningMatch(
  candidate: string | null,
  references: SendRecipientReference[],
): AddressPoisoningMatch | null {
  if (!validAddress(candidate)) return null;
  const body = candidate.slice(2).toLowerCase();
  let best: AddressPoisoningMatch | null = null;
  for (const reference of references) {
    if (!validAddress(reference.address)) continue;
    const known = reference.address.slice(2).toLowerCase();
    if (body === known) continue;
    let prefixLength = 0;
    let suffixLength = 0;
    while (prefixLength < 40 && body[prefixLength] === known[prefixLength]) prefixLength++;
    while (suffixLength < 40 - prefixLength
      && body[39 - suffixLength] === known[39 - suffixLength]) suffixLength++;
    const score = prefixLength + suffixLength;
    if (score < 8) continue;
    const bestScore = best ? best.prefixLength + best.suffixLength : -1;
    if (!best || score > bestScore || (score === bestScore
      && Math.min(prefixLength, suffixLength) > Math.min(best.prefixLength, best.suffixLength))) {
      best = { ...reference, prefixLength, suffixLength };
    }
  }
  return best;
}

export function parseSendRecipientReferences(value: unknown): SendRecipientReference[] {
  const result = value as { success?: unknown; references?: unknown } | null;
  if (result?.success !== true || !Array.isArray(result.references)
    || result.references.length > 1500) throw new Error("Recipient check unavailable");
  return result.references.map((reference: SendRecipientReference) => {
    if (!reference || !validAddress(reference.address)
      || (reference.source !== "contact" && reference.source !== "history")
      || (reference.label !== undefined && (typeof reference.label !== "string"
        || reference.label.length > 64))) throw new Error("Recipient check unavailable");
    return { address: reference.address, source: reference.source, label: reference.label };
  });
}

export function canProceedWithRecipientCheck(
  status: "loading" | "ready" | "error",
  match: AddressPoisoningMatch | null,
  acknowledged: boolean,
): boolean {
  return status === "ready" && (!match || acknowledged);
}
