import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createChromeStorageHarness } from "../helpers/chromeStorageHarness";
import { compactHistoryTransaction } from "../../src/chrome/history/recordCodec";
import { getRecordedSendRecipient } from "../../src/chrome/history/sendRecipient";
import type { CompletedTransaction } from "../../src/chrome/history/types";

const sender = `0x${"1".repeat(40)}`;
const recipient = `0x${"2".repeat(40)}`;
const token = `0x${"3".repeat(40)}`;
const data = `0xa9059cbb${"0".repeat(24)}${recipient.slice(2)}${"0".repeat(63)}1`;
const hash = `0x${"4".repeat(64)}`;
function entry(overrides: Partial<CompletedTransaction> = {}): CompletedTransaction {
  return { id: "send", status: "success", tx: { from: sender, to: token, data, value: "0x0", chainId: 8453 },
    origin: "Send USDC", favicon: null, chainName: "Base", chainId: 8453, createdAt: 1,
    txHash: hash, accountType: "privateKey", ...overrides };
}

for (const accountType of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
  test(`${accountType}: preserve actual payee through processing, compaction, and confirmation`, () => {
    const processing = compactHistoryTransaction(entry({ status: "processing", txHash: undefined, accountType })).transaction;
    assert.equal(processing.sendRecipient, recipient);
    const pending = compactHistoryTransaction({ ...processing, status: "pending", txHash: hash }).transaction;
    assert.equal(pending.tx.data, undefined);
    assert.equal(pending.sendRecipient, recipient);
    const success = compactHistoryTransaction({ ...pending, status: "success" }).transaction;
    assert.equal(getRecordedSendRecipient(success), recipient);
    assert.notEqual(success.sendRecipient, token);
  });
}

test("native and sponsored sends retain their real recipient", () => {
  assert.equal(getRecordedSendRecipient(entry({ tx: { from: sender, to: recipient, data: "0x", value: "1", chainId: 1 } })), recipient);
  assert.equal(getRecordedSendRecipient(entry({ origin: "Send USDC (Sponsored)",
    tx: { from: sender, to: token, data: "0x", value: "0", chainId: 8453 },
    transferMeta: { recipient, amount: "1", symbol: "USDC", tokenLogo: null } })), recipient);
});

test("do not learn approvals, incoming logs, arbitrary calls, cancellations, or impersonator sends", () => {
  const incoming = { version: 2 as const, blockNumber: "1", erc20Transfers: [
    { token, direction: "in" as const, counterparty: recipient, amountWei: "0" },
  ] };
  for (const record of [
    entry({ origin: "https://dapp.example", assetChanges: incoming }),
    entry({ accountType: "impersonator" }),
    entry({ replacement: { kind: "cancel" } as CompletedTransaction["replacement"] }),
    entry({ tx: { ...entry().tx, data: data.replace("a9059cbb", "095ea7b3") } }),
    entry({ tx: { ...entry().tx, data: "0x12345678" } }),
    entry({ tx: { ...entry().tx, data: `${data}00` } }),
    entry({ tx: { ...entry().tx, data: data.replace("0".repeat(24), `1${"0".repeat(23)}`) } }),
    entry({ tx: { ...entry().tx, to: null } }),
    entry({ tx: { ...entry().tx, data: undefined }, assetChanges: incoming }),
  ]) assert.equal(getRecordedSendRecipient(record), null);
});

test("only consistent local snapshots backfill already compacted sends", () => {
  const compact = entry({ tx: { ...entry().tx, data: undefined }, calldataSelector: "0xa9059cbb",
    clearSignedMeta: { kind: "transfer", tokenAddress: token, counterparty: recipient } });
  assert.equal(getRecordedSendRecipient(compact), recipient);
  assert.equal(getRecordedSendRecipient({ ...compact, clearSignedMeta: { kind: "approve", counterparty: recipient } }), null);
  assert.equal(getRecordedSendRecipient({ ...compact, clearSignedMeta: { kind: "transfer", tokenAddress: sender, counterparty: recipient } }), null);
});

test("local projection reads durable successful sends across chains and follows history/contact deletion", async () => {
  const previousDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const previousRange = Object.getOwnPropertyDescriptor(globalThis, "IDBKeyRange");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() });
  Object.defineProperty(globalThis, "IDBKeyRange", { configurable: true, value: IDBKeyRange });
  const harness = createChromeStorageHarness({ local: { addressContacts: [{ address: sender, label: "Alice" }] } });
  const database = await import("../../src/chrome/history/database");
  try {
    const repository = await import("../../src/chrome/history/repository");
    const { getSendRecipientReferences } = await import("../../src/chrome/history/sendRecipientReferences");
    const { clearTxHistory } = await import("../../src/chrome/history/maintenance");
    await repository.addTxToHistory(entry({ status: "processing", txHash: undefined }));
    assert.deepEqual((await getSendRecipientReferences()).map((r) => r.address), [sender]);
    await repository.updateTxInHistory("send", { status: "pending", txHash: hash });
    assert.equal((await getSendRecipientReferences()).length, 1);
    await repository.updateTxInHistory("send", { status: "success" });
    assert.deepEqual((await getSendRecipientReferences()).map((r) => r.address), [sender, recipient]);
    await repository.addTxToHistory(entry({ id: "failed", status: "failed", sendRecipient: token }));
    await repository.addTxToHistory(entry({ id: "other-chain", chainId: 1 }));
    assert.equal((await getSendRecipientReferences()).length, 2);
    await clearTxHistory();
    assert.deepEqual((await getSendRecipientReferences()).map((r) => r.address), [sender]);
    Reflect.deleteProperty(harness.stores.local, "addressContacts");
    assert.deepEqual(await getSendRecipientReferences(), []);
  } finally {
    await database.resetHistoryDatabaseConnectionForTests();
    harness.restore();
    if (previousDb) Object.defineProperty(globalThis, "indexedDB", previousDb); else Reflect.deleteProperty(globalThis, "indexedDB");
    if (previousRange) Object.defineProperty(globalThis, "IDBKeyRange", previousRange); else Reflect.deleteProperty(globalThis, "IDBKeyRange");
  }
});
