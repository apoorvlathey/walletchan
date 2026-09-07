import assert from "node:assert/strict";
import test from "node:test";
import {
  canProceedWithRecipientCheck,
  findAddressPoisoningMatch,
  parseSendRecipientReferences,
} from "../../src/components/Transfer/model/addressPoisoning";

const address = `0x${"1".repeat(40)}`;
const references = [{ address, source: "contact" as const, label: "Alice" }];
const lookalike = (prefix: number, suffix: number) =>
  `0x${"1".repeat(prefix)}${"2".repeat(40 - prefix - suffix)}${"1".repeat(suffix)}`;

test("detects classic and asymmetric lookalikes without counting 0x", () => {
  for (const [prefix, suffix] of [[4, 4], [3, 5], [0, 8], [8, 0], [6, 5]]) {
    const match = findAddressPoisoningMatch(lookalike(prefix, suffix), references);
    assert.equal(match?.prefixLength, prefix);
    assert.equal(match?.suffixLength, suffix);
    assert.equal(match?.label, "Alice");
  }
  for (const [prefix, suffix] of [[3, 4], [2, 4], [0, 7], [0, 0]]) {
    assert.equal(findAddressPoisoningMatch(lookalike(prefix, suffix), references), null);
  }
});

test("ignores exact/case-only addresses, malformed input, and empty history", () => {
  const mixed = `0x${"ab".repeat(20)}`;
  assert.equal(findAddressPoisoningMatch(mixed.toUpperCase(), [{ address: mixed, source: "history" }]), null);
  assert.equal(findAddressPoisoningMatch(address, references), null);
  for (const invalid of [null, "", "alice.eth", address.slice(0, -1), `${address}0`, "0xzzzz"]) {
    assert.equal(findAddressPoisoningMatch(invalid, references), null);
  }
  assert.equal(findAddressPoisoningMatch(lookalike(4, 4), []), null);
});

test("chooses the strongest reference; exact match with another reference does not erase a warning", () => {
  const candidate = lookalike(5, 5);
  const stronger = `${candidate.slice(0, 10)}${"3".repeat(24)}${candidate.slice(-8)}`;
  const match = findAddressPoisoningMatch(candidate, [...references,
    { address: stronger, source: "history" }, { address: candidate, source: "contact" }]);
  assert.equal(match?.address, stronger);
});

test("a suspicious recipient needs acknowledgement; pending/error checks never imply safe", () => {
  const match = findAddressPoisoningMatch(lookalike(4, 4), references);
  assert.equal(canProceedWithRecipientCheck("ready", match, false), false);
  assert.equal(canProceedWithRecipientCheck("ready", match, true), true);
  assert.equal(canProceedWithRecipientCheck("ready", null, false), true);
  assert.equal(canProceedWithRecipientCheck("loading", null, true), false);
  assert.equal(canProceedWithRecipientCheck("error", null, true), false);
});

test("malformed/error responses cannot silently become an empty successful check", () => {
  assert.deepEqual(parseSendRecipientReferences({ success: true, references: [] }), []);
  assert.deepEqual(parseSendRecipientReferences({ success: true, references }), references);
  for (const response of [null, [], { success: false }, { success: true },
    { success: true, references: [null] },
    { success: true, references: [{ address, source: "incoming" }] },
    { success: true, references: Array(1501).fill(references[0]) }]) {
    assert.throws(() => parseSendRecipientReferences(response));
  }
});
