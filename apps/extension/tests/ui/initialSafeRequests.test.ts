import assert from "node:assert/strict";
import test from "node:test";
import { getSafeRequestAccount, loadInitialSafeProposals } from "../../src/app/initialSafeRequests";

test("bootstrap restores only local dapp Safe requests and leaves imported proposals on Home", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: {
    sendMessage: async () => ({ success: true, result: [
      { id: "new", state: "draft", createdAt: 3 },
      { id: "executed", state: "executed", createdAt: 4 },
      { id: "hidden", state: "draft", hiddenAt: 4, createdAt: 4 },
      { id: "old", state: "awaitingApprovals", createdAt: 1 },
      { id: "remote", state: "awaitingApprovals", createdAt: 9, route: { kind: "wallet", origin: "https://app.safe.global" } },
      { id: "internal", state: "draft", createdAt: 8, route: { kind: "wallet", origin: "WalletChan" } },
      { id: "detached", state: "awaitingApprovals", createdAt: 7, route: { kind: "injected", detachedAt: 7 } },
      { id: "wc", state: "awaitingApprovals", createdAt: 5, route: { kind: "walletConnect" } },
      { id: "batch", state: "awaitingApprovals", createdAt: 6, route: { kind: "erc5792" } },
    ].map((record) => ({ ...record, chainId: 8453,
      safeAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      transaction: { nonce: record.state === "executed" ? 15 : 16 },
      route: record.route ?? { kind: "injected" } })) }),
  } } });
  try {
    assert.deepEqual((await loadInitialSafeProposals()).map((proposal) => proposal.id), ["old", "new", "wc", "batch"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else delete (globalThis as any).chrome;
  }
});

test("request account resolution ignores the selected EOA and rejects a removed Safe", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  let accounts = [{ id: "eoa", type: "privateKey" }, { id: "safe", type: "safe" }];
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: {
    sendMessage: async (message: any) => message.type === "getAccounts" ? accounts :
      { success: true, result: { safeAccountId: "safe" } },
  } } });
  try {
    assert.equal((await getSafeRequestAccount("proposal"))?.id, "safe");
    accounts = accounts.slice(0, 1);
    assert.equal(await getSafeRequestAccount("proposal"), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else delete (globalThis as any).chrome;
  }
});
