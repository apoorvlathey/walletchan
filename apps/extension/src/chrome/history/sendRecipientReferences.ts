import { getAddressContacts } from "../contactBook/repository";
import { queryHistoryPage } from "./database";
import { getRecordedSendRecipient, normalizedSendAddress } from "./sendRecipient";
import type { TxHistoryCursor } from "./queryTypes";

export interface SendRecipientReference {
  address: string;
  source: "contact" | "history";
  label?: string;
}

/** Bounded, local-only projection. Clearing/evicting history also removes references. */
export async function getSendRecipientReferences(): Promise<SendRecipientReference[]> {
  const references = new Map<string, SendRecipientReference>();
  for (const contact of await getAddressContacts()) {
    const address = normalizedSendAddress(contact.address);
    if (address) references.set(address, { address, source: "contact", label: contact.label });
  }
  let cursor: TxHistoryCursor | null = null;
  // Limit work independently of the number of accounts/networks in the vault.
  for (let pageIndex = 0; pageIndex < 100 && references.size < 1500; pageIndex++) {
    const page = await queryHistoryPage({ cursor, limit: 100 });
    for (const entry of page.items) {
      if (entry.status !== "success" || !entry.txHash) continue;
      const address = getRecordedSendRecipient(entry);
      if (address && !references.has(address)) references.set(address, { address, source: "history" });
      if (references.size >= 1500) break;
    }
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return [...references.values()];
}
