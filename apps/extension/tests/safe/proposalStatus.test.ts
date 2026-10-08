import assert from "node:assert/strict";
import test from "node:test";
import { getPendingSafeRequests, isPendingSafeProposal } from "../../src/chrome/safe/proposalStatus";
import type { SafeProposalRecord, SafeProposalState } from "../../src/chrome/safe/types";

const unresolved: SafeProposalState[] = [
  "draft",
  "authorizing",
  "approvedLocally",
  "publishing",
  "awaitingApprovals",
  "readyToExecute",
  "executing",
  "ambiguous",
  "stale",
  "blocked",
];

const terminal: SafeProposalState[] = [
  "executed",
  "cancelled",
  "replaced",
  "failed",
];

test("all unresolved Safe request states contribute to pending counts", () => {
  for (const state of unresolved) {
    assert.equal(isPendingSafeProposal({ state }), true, state);
  }
});

test("terminal and hidden Safe requests do not contribute to pending counts", () => {
  for (const state of terminal) {
    assert.equal(isPendingSafeProposal({ state }), false, state);
  }
  assert.equal(isPendingSafeProposal({ state: "blocked", hiddenAt: 1 }), false);
});

test("unsigned rejection reviews enter pending counts only after a signature is saved", () => {
  const draft = { state: "draft" as const, purpose: "rejection" as const, confirmations: [] };
  assert.equal(isPendingSafeProposal(draft), false);
  assert.equal(isPendingSafeProposal({ ...draft, state: "authorizing" }), false);
  assert.equal(isPendingSafeProposal({
    ...draft, state: "approvedLocally",
    confirmations: [{ ownerAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
      signature: `0x${"11".repeat(65)}`, createdAt: 1 }],
  }), true);
});

test("submitted rejection removes its whole nonce slot from requests until settlement", () => {
  // Projection fixture: only scope, nonce, state and execution evidence are consumed.
  const original = {
    id: "original", chainId: 8453, safeAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    transaction: { nonce: 16 }, state: "awaitingApprovals", confirmations: [],
  } as unknown as SafeProposalRecord;
  const next = { ...original, id: "next", transaction: { ...original.transaction, nonce: 17 } };
  const rejection = { ...original, id: "rejection", purpose: "rejection" as const,
    state: "readyToExecute" as const };
  assert.deepEqual(getPendingSafeRequests([original, next, rejection]).map((p) => p.id),
    ["original", "next", "rejection"]);
  const submitted = { ...rejection, state: "executing" as const,
    transactionHash: `0x${"11".repeat(32)}` as `0x${string}` };
  assert.deepEqual(getPendingSafeRequests([original, next, submitted]), [next]);
  assert.deepEqual(getPendingSafeRequests([original, next, { ...submitted, state: "ambiguous" }]), [next]);
  assert.deepEqual(getPendingSafeRequests([original, next, { ...submitted, state: "executed" }]), [next],
    "confirmed rejection stays suppressed before competing records finish settlement");
  assert.deepEqual(getPendingSafeRequests([original, next, { ...submitted, state: "replaced" }]), [next],
    "verified nonce advancement stays suppressed even if the exact receipt is delayed");
  assert.deepEqual(getPendingSafeRequests([original, next, { ...submitted, state: "failed" }]), [original, next]);
  assert.equal(isPendingSafeProposal(submitted), true, "receipt and detail remain unresolved");
  assert.deepEqual(getPendingSafeRequests([original, { ...submitted, hiddenAt: 1 }]), [],
    "hidden execution evidence still suppresses the original");
  assert.deepEqual(getPendingSafeRequests([original, { ...submitted, chainId: 1 }]), [original]);
  assert.deepEqual(getPendingSafeRequests([original, { ...submitted, safeAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }]), [original]);
  assert.deepEqual(getPendingSafeRequests([original, { ...submitted, transactionHash: undefined,
    userOperationHash: `0x${"22".repeat(32)}` }]), [], "fee-token execution follows the same projection");
  assert.deepEqual(getPendingSafeRequests([original, { ...rejection, state: "ambiguous" }]),
    [original, { ...rejection, state: "ambiguous" }], "publication ambiguity does not hide requests");
});
