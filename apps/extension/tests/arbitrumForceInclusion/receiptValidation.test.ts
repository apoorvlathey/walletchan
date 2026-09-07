import assert from "node:assert/strict";
import test from "node:test";
import { keccak256 } from "viem";
import { delayedMessageSender, validateDelayedMessage, validateRecoveredMessage } from "../../src/chrome/arbitrumForceInclusion/receiptValidation";

const sender = "0x1234567890123456789012345678901234567890";
const data = "0x04deadbeef" as const;
const childHash = keccak256("0xdeadbeef");
const delivered = {
  messageIndex: 0n, beforeInboxAcc: childHash,
  inbox: sender as `0x${string}`, kind: 3,
  sender: "0x23455678901234567890123456789012345689a1" as const,
  messageDataHash: keccak256(data), baseFeeL1: 42n, timestamp: 123n,
};
const inbox = { messageNum: 0n, data };

test("Nitro sender alias has uint160 wrapping and zero padding", () => {
  assert.equal(delayedMessageSender(sender), delivered.sender);
  assert.equal(delayedMessageSender("0xffffffffffffffffffffffffffffffffffffffff"),
    "0x1111000000000000000000000000000000001110");
  assert.equal(delayedMessageSender("0xeeeeffffffffffffffffffffffffffffffffeeef"),
    "0x0000000000000000000000000000000000000000");
});

test("valid receipt passes submission and recovery, including message index zero", () => {
  validateDelayedMessage(delivered, sender, data);
  validateRecoveredMessage(delivered, inbox, sender, childHash);
});

test("raw sender and unrelated alias remain rejected", () => {
  for (const wrongSender of [sender, delayedMessageSender("0x1")]) {
    assert.throws(() => validateRecoveredMessage(
      { ...delivered, sender: wrongSender as `0x${string}` }, inbox, sender, childHash,
    ), /aliased sender/);
  }
});

test("recovery reports each binding failure without accepting invalid metadata", () => {
  assert.throws(() => validateRecoveredMessage({ ...delivered, kind: 9 }, inbox, sender, childHash), /message kind/);
  assert.throws(() => validateRecoveredMessage({ ...delivered, messageDataHash: childHash }, inbox, sender, childHash), /message data hash/);
  assert.throws(() => validateRecoveredMessage(delivered, { ...inbox, messageNum: 1n }, sender, childHash), /message index/);
  const unsigned = "0x03deadbeef";
  assert.throws(() => validateRecoveredMessage({ ...delivered, messageDataHash: keccak256(unsigned) }, { ...inbox, data: unsigned }, sender, childHash), /signed transaction prefix/);
  assert.throws(() => validateRecoveredMessage(delivered, inbox, sender, keccak256("0xbeef")), /child transaction hash/);
});
