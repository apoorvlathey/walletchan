import type { CompletedTransaction } from "@/chrome/history/types";
import { getRecordedSendRecipient } from "@/chrome/history/sendRecipient";
import type { SendRecipientReference } from "@/chrome/history/sendRecipientReferences";
import type { PreviewEnvironment } from "./previewEnvironment";

export function previewSendRecipientReferences(environment: PreviewEnvironment) {
  const references: SendRecipientReference[] = environment.contacts.map((contact) => ({
    address: contact.address, label: contact.label, source: "contact",
  }));
  for (const tx of environment.txHistory as CompletedTransaction[]) {
    const address = tx.status === "success" && tx.txHash ? getRecordedSendRecipient(tx) : null;
    if (address) references.push({ address, source: "history" });
  }
  return { success: true, references };
}

export function previewHistoryPage(environment: PreviewEnvironment, message: any) {
  const filtered = (environment.txHistory as CompletedTransaction[]).filter((tx) =>
    (!message.ownerAddress || tx.tx.from.toLowerCase() === String(message.ownerAddress).toLowerCase())
    && (message.chainId == null || tx.chainId === message.chainId));
  const start = message.cursor
    ? Math.max(0, filtered.findIndex((tx) => tx.id === message.cursor.id) + 1) : 0;
  const limit = typeof message.limit === "number" ? message.limit : 30;
  const items = filtered.slice(start, start + limit);
  const hasMore = start + items.length < filtered.length;
  const last = items.at(-1);
  return { items, hasMore, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}
