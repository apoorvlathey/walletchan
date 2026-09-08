import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData, hashTypedData } from "viem";
import { analyzeSafeTransactionRisk, analyzeSafeTypedDataRisk } from "../../src/chrome/safe/transactionRisk";
import { buildSafeTransaction } from "../../src/chrome/safe/transactionBuilder";
import { buildSafeTransactionTypedData } from "../../src/chrome/safe/transactionHash";
import { getCanonicalMultiSendAddress } from "../../src/chrome/safe/deploymentRegistry";

const SAFE = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const ZERO = "0x0000000000000000000000000000000000000000";
const call = { to: TO, value: "0", data: "0x", operation: 0 } as const;
function fixture(batch = false): any {
  const input = { chainId: 1, safeAddress: SAFE, safeVersion: "1.4.1", nonce: 0n, calls: batch ? [call, call] : [call] } as const;
  const { transaction } = buildSafeTransaction(input);
  return structuredClone(buildSafeTransactionTypedData({ ...input, transaction }));
}
function analyze(data: any, chain = 1) { return analyzeSafeTypedDataRisk(data, chain); }
const abi = [{ type: "function", name: "multiSend", stateMutability: "payable", inputs: [{ name: "transactions", type: "bytes" }], outputs: [] }] as const;
function packed(operation: string, target = TO, data = "") {
  return `${operation}${target.slice(2)}${"0".repeat(64)}${(data.length / 2).toString(16).padStart(64, "0")}${data}`;
}
function withBatchPayload(payload: string) {
  const data = fixture(true);
  data.message.data = encodeFunctionData({ abi, functionName: "multiSend", args: [`0x${payload}`] });
  return data;
}

test("ordinary Safe transaction has no warning and analysis never mutates signed fields", () => {
  const data = fixture();
  const before = structuredClone(data);
  assert.deepEqual(analyze(data), { delegatecall: false, refund: null });
  assert.deepEqual(data, before);
});

test("full SafeTx schema recognition rejects names, reordered and changed field types", () => {
  for (const mutate of [
    (d: any) => d.primaryType = "Other",
    (d: any) => d.types.SafeTx.pop(),
    (d: any) => d.types.SafeTx.push({ name: "extra", type: "uint256" }),
    (d: any) => d.types.SafeTx.reverse(),
    (d: any) => d.types.SafeTx[3].type = "uint256",
    (d: any) => d.types.SafeTx[3].name = "action",
    (d: any) => d.types = null,
  ]) {
    const data = fixture(); mutate(data); assert.equal(analyze(data), null);
  }
  for (const data of [null, [], "SafeTx", {}, { primaryType: "SafeTx" }]) assert.equal(analyze(data), null);
});

test("arbitrary delegatecall always warns for decimal/hex and numeric operation", () => {
  for (const operation of [1, "1", "01", "0x01"]) {
    const data = fixture(); data.message.operation = operation;
    assert.equal(analyze(data)?.delegatecall, true);
  }
});

test("known chain canonical CALL-only MultiSend is the narrow exemption", () => {
  for (const chain of [1, 8453]) {
    const data = fixture(true);
    data.domain.chainId = `0x${chain.toString(16)}`;
    data.message.to = getCanonicalMultiSendAddress(chain, "1.4.1");
    assert.equal(analyze(data, chain)?.delegatecall, false);
  }
});

test("inner delegatecall, nested canonical delegatecall and invalid operation retain warning", () => {
  const multiSend = fixture(true).message.to;
  for (const payload of [packed("01"), packed("01", multiSend, fixture(true).message.data.slice(2)), packed("02")]) {
    assert.equal(analyze(withBatchPayload(payload))?.delegatecall, true);
  }
  // CALL into another contract has that contract's context, not Safe's storage.
  assert.equal(analyze(withBatchPayload(packed("00", multiSend, fixture(true).message.data.slice(2))))?.delegatecall, false);
});

test("address-only, malformed, truncated, empty, trailing and oversized batch data never suppress warning", () => {
  const valid = fixture(true).message.data;
  for (const data of ["0x", "0xzz", valid.slice(0, -2), `${valid}00`, "0x" + "00".repeat(150000)]) {
    const typed = fixture(true); typed.message.data = data;
    assert.equal(analyze(typed)?.delegatecall, true);
  }
  for (const payload of ["", "00", packed("00").slice(0, -2), packed("00").repeat(101)]) {
    assert.equal(analyze(withBatchPayload(payload))?.delegatecall, true);
  }
  const badLength = packed("00").slice(0, -64) + "f".repeat(64);
  assert.equal(analyze(withBatchPayload(badLength))?.delegatecall, true);
  const typed = fixture(true); typed.message.value = "1";
  assert.equal(analyze(typed)?.delegatecall, true);
});

test("chain mismatch, unknown chain, malformed domain and spoofed address retain warning", () => {
  for (const mutate of [
    (d: any) => d.domain.chainId = 8453,
    (d: any) => d.domain.chainId = "1e0",
    (d: any) => d.domain.chainId = true,
    (d: any) => d.domain.chainId = Number.MAX_SAFE_INTEGER + 1,
    (d: any) => delete d.domain.chainId,
    (d: any) => d.domain.verifyingContract = "0x12",
    (d: any) => delete d.types.EIP712Domain,
    (d: any) => d.types.EIP712Domain.reverse(),
    (d: any) => d.message.to += "00",
    (d: any) => d.message.to = TO,
  ]) { const data = fixture(true); mutate(data); assert.equal(analyze(data)?.delegatecall, true); }
  const unknown = fixture(true); unknown.domain.chainId = 9007199254740991;
  assert.equal(analyze(unknown, 9007199254740991)?.delegatecall, true);
});

test("refund warning detects every positive signed gas price without estimates or mutation", () => {
  for (const gasPrice of [true, 1e20, 1, "1", "0001", "0x01", "0X01", " 1 ", "+1", "0b01", "0o01", "0".repeat(1000) + "1", "0x" + "0".repeat(1000) + "1", ((1n << 256n) - 1n).toString()]) {
    const data = fixture(); data.message.gasPrice = gasPrice;
    const before = structuredClone(data);
    assert.deepEqual(analyze(data)?.refund, { gasToken: ZERO, refundReceiver: ZERO });
    assert.deepEqual(data, before);
  }
  for (const gasPrice of [0, "0", "000", "0x00", "0".repeat(1000), "0x" + "0".repeat(1000)]) {
    const data = fixture(); data.message.gasPrice = gasPrice; data.message.baseGas = "9007199254740991900719925474099199";
    assert.equal(analyze(data)?.refund, null);
  }
  const data = fixture(); Object.assign(data.message, { gasPrice: "1", gasToken: TO, refundReceiver: SAFE });
  assert.deepEqual(analyzeSafeTransactionRisk(data.message, 1).refund, { gasToken: TO, refundReceiver: SAFE });
});

test("malformed uints never suppress delegatecall or possible refund warnings", () => {
  for (const value of [null, [], {}, "", "-1", "1e0", "0x", "1".repeat(10000), (1n << 256n).toString()]) {
    const data = fixture(true); data.message.operation = value;
    assert.equal(analyze(data)?.delegatecall, true);
    data.message.gasPrice = value;
    assert.notEqual(analyze(data)?.refund, null);
  }
});

test("accepted noncanonical prices match viem signing and always disclose reimbursement", () => {
  for (const gasPrice of [[1], ["1"], true, "0".repeat(1000) + "1", " +1 ", "0X01", "0b1", "0o1"]) {
    const data = fixture(); data.message.gasPrice = gasPrice;
    const canonical = fixture(); canonical.message.gasPrice = "1";
    assert.equal(hashTypedData(data), hashTypedData(canonical));
    assert.notEqual(analyze(data)?.refund, null);
  }
  const data = fixture(); data.message.gasPrice = 1e20;
  const canonical = fixture(); canonical.message.gasPrice = "100000000000000000000";
  assert.equal(hashTypedData(data), hashTypedData(canonical));
  assert.notEqual(analyze(data)?.refund, null);
});
