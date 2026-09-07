import assert from "node:assert/strict";
import test from "node:test";
import { handleAppendApprovalRevokeToPendingBatch } from "../../src/chrome/batch/approvalCleanup";
import { handleAddToCrossDappBatch } from "../../src/chrome/crossDappBatch/intake";
import { createChromeStorageHarness } from "../helpers/chromeStorageHarness";
import { parseApproveCalldata } from "../../src/lib/erc20Approve";

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const spender = "0x3333333333333333333333333333333333333333";
const account = { id: "bankr-1", type: "bankr", address: wallet };
const pinned = { accountId: account.id, accountType: account.type, accountAddress: wallet, bankrCredentialTag: "original-credential" };
const tx = { from: wallet, to: token, data: "0x", value: "0x0", chainId: 8453 };

for (const family of ["single", "batch"] as const) {
  test(`Bankr ${family} cleanup preserves source authority and appends a final revoke`, async () => {
    const request = { id: "request", ...pinned, tx, params: { from: wallet, calls: [tx] }, chainId: 8453, chainName: "Base", origin: "https://dapp.example", favicon: null, timestamp: Date.now() };
    const harness = createChromeStorageHarness({ local: { accounts: [account], pendingTxRequests: [request], pendingBatchTxRequests: [request] } });
    try {
      const result = family === "single"
        ? await handleAddToCrossDappBatch(request.id, { tokenAddress: token, spender })
        : await handleAppendApprovalRevokeToPendingBatch(request.id, token, spender);
      assert.deepEqual(result, { success: true });
      const stored = harness.snapshot("local") as any;
      const source = family === "single" ? stored.crossDappBatch.entries[0] : stored.pendingBatchTxRequests[0];
      assert.equal(source.bankrCredentialTag, pinned.bankrCredentialTag);
      assert.equal(source.accountType, "bankr");
      const calls = family === "single" ? stored.crossDappBatch.entries.map((entry: any) => entry.tx) : source.params.calls;
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[0], tx);
      assert.equal(parseApproveCalldata(calls[1].data)?.isRevoke, true);
      if (family === "single") {
        assert.equal(stored.pendingTxRequests.length, 0);
        assert.equal(stored.crossDappBatch.entries[1].source.parentTxId, request.id);
      } else {
        assert.equal(source.params.atomicRequired, true);
      }
    } finally { harness.restore(); }
  });
}

for (const scenario of ["unsupported-chain", "changed-account"] as const) {
  test(`Bankr cleanup rejects ${scenario} without changing the pending request`, async () => {
    const request = { id: "request", ...pinned, params: { from: wallet, calls: [tx] }, chainId: scenario === "unsupported-chain" ? 31337 : 8453, chainName: "test", timestamp: Date.now() };
    const harness = createChromeStorageHarness({ local: { accounts: [{ ...account, address: scenario === "changed-account" ? spender : wallet }], pendingBatchTxRequests: [request] } });
    try {
      assert.equal((await handleAppendApprovalRevokeToPendingBatch(request.id, token, spender)).success, false);
      assert.deepEqual(harness.snapshot("local").pendingBatchTxRequests, [request]);
    } finally { harness.restore(); }
  });
}
