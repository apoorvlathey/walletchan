import assert from "node:assert/strict";
import test from "node:test";
import { canSafeOwnerSignAndExecute } from "../../src/chrome/safe/signAndExecutePolicy";
import { buildSafeFinalOwnerPreviewData, decodeSafeExecutionData, buildSafeExecutionData } from "../../src/chrome/safe/executionData";
import { buildSafeTransaction } from "../../src/chrome/safe/transactionBuilder";
import { signAndExecuteSafeProposal } from "../../src/chrome/safe/signAndExecute";
import type { Account } from "../../src/chrome/types";
import type { SafeChainSnapshot, SafeProposalRecord } from "../../src/chrome/safe/types";
const owner = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const safeAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const built = buildSafeTransaction({ chainId: 8453, safeAddress, safeVersion: "1.4.1", nonce: 4n, calls: [{ to: other, value: "0", data: "0x", operation: 0 }] });
const snapshot = { configEpoch: "epoch", nonce: "4", owners: [owner, other], threshold: 2, contractOwners: [] } as unknown as SafeChainSnapshot;
const proposal = {
  version: 1, id: "proposal", safeAccountId: "safe", chainId: 8453, safeAddress,
  safeConfigEpoch: "epoch", safeVersion: "1.4.1", safeTxHash: built.safeTxHash,
  transaction: built.transaction, calls: built.calls, state: "awaitingApprovals",
  confirmations: [{ ownerAddress: other, signature: `0x${"11".repeat(64)}1b`, createdAt: 1 }],
  route: { kind: "injected" },
} as SafeProposalRecord;
const gas = { gasLimit: "100000", maxFeePerGas: "10", maxPriorityFeePerGas: "1" };
const account = (type: Account["type"]) => ({ id: "owner", type, address: owner, createdAt: 1 } as Account);
for (const type of ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"] as const) {
  test(`${type} final-owner eligibility follows the shared execution policy`, () => {
    assert.equal(canSafeOwnerSignAndExecute(proposal, snapshot, account(type)), ["privateKey", "seedPhrase", "ledger"].includes(type));
  });
}
test("only the final unconfirmed owner at the executable nonce is eligible", () => {
  assert.equal(canSafeOwnerSignAndExecute({ ...proposal, confirmations: [] }, snapshot, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute(proposal, { ...snapshot, nonce: "3" }, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute(proposal, { ...snapshot, owners: [other] }, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute(proposal, { ...snapshot, configEpoch: "changed" }, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute(proposal, { ...snapshot, blockedReason: "Unsafe module" }, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute(proposal, snapshot, { ...account("privateKey"), address: other }), false);
  assert.equal(canSafeOwnerSignAndExecute({ ...proposal, state: "executing" }, snapshot, account("privateKey")), false);
  assert.equal(canSafeOwnerSignAndExecute({ ...proposal, confirmations: [] }, { ...snapshot, threshold: 1 }, account("privateKey")), true);
});
test("preview-only owner entry is sorted and never added to real confirmations", () => {
  const before = structuredClone(proposal);
  const preview = buildSafeFinalOwnerPreviewData(proposal, owner);
  assert.deepEqual(decodeSafeExecutionData(preview), decodeSafeExecutionData(buildSafeExecutionData(proposal)));
  assert.equal(preview.length - buildSafeExecutionData(proposal).length, 128);
  assert.ok(preview.includes(`${owner.slice(2).padStart(64, "0")}${"0".repeat(64)}01${proposal.confirmations[0].signature.slice(2)}`));
  assert.deepEqual(proposal, before);
  assert.throws(() => buildSafeFinalOwnerPreviewData(proposal, other), /Invalid final/);
});
function dependencies(type: Account["type"] = "privateKey", estimatedGas = "90000") {
  const calls: string[] = [];
  const deps = {
    getSafeProposal: async () => proposal,
    getAccountById: async () => account(type),
    verifySafeOnchainState: async () => snapshot,
    approveSafeProposalWithOwner: async () => { calls.push("approve"); return { ...proposal, state: "readyToExecute" as const }; },
    authorizeSafeProposalRoute: async () => { calls.push("ack"); },
    estimateSafeExecution: async () => { calls.push("estimate"); return { gas: estimatedGas, executor: owner, safeTxHash: proposal.safeTxHash }; },
    executeSafeProposal: async (input: any) => { calls.push("execute"); assert.deepEqual(input.gasOverrides, gas); assert.equal(input.executorAccountId, "owner"); assert.equal(input.feePaymentToken, "native"); return proposal; },
  };
  return { calls, deps };
}
for (const type of ["privateKey", "seedPhrase", "ledger"] as const) {
  test(`${type} combined action approves, acknowledges, checks the exact fee, then executes`, async () => {
    const { calls, deps } = dependencies(type);
    await signAndExecuteSafeProposal({ proposalId: "proposal", ownerAccountId: "owner", gasOverrides: gas }, deps);
    assert.deepEqual(calls, ["approve", "ack", "estimate", "execute"]);
  });
}
test("Bankr cannot enter native execution through the combined action", async () => {
  const { calls, deps } = dependencies("bankr");
  await assert.rejects(signAndExecuteSafeProposal({ proposalId: "proposal", ownerAccountId: "owner", gasOverrides: gas }, deps), /requires the last/);
  assert.deepEqual(calls, []);
});
test("an increased gas requirement preserves approval without exceeding the reviewed cap", async () => {
  const { calls, deps } = dependencies("privateKey", "100001");
  await assert.rejects(signAndExecuteSafeProposal({ proposalId: "proposal", ownerAccountId: "owner", gasOverrides: gas }, deps), /Approval saved.*reviewed limit/);
  assert.deepEqual(calls, ["approve", "ack", "estimate"]);
});
test("a rejected signature never reaches acknowledgement or execution", async () => {
  const { calls, deps } = dependencies();
  deps.approveSafeProposalWithOwner = async () => { calls.push("approve"); throw new Error("Device rejected"); };
  await assert.rejects(signAndExecuteSafeProposal({ proposalId: "proposal", ownerAccountId: "owner", gasOverrides: gas }, deps), /Device rejected/);
  assert.deepEqual(calls, ["approve"]);
});
