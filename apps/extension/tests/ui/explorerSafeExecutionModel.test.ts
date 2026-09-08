import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, encodeFunctionData, parseAbi, type Hex } from "viem";
import fixture from "../explorerTransaction/fixtures/monadSafeTransaction.json";
import { decodeExplorerSafeExecution } from "../../src/components/ExplorerTransaction/safeExecutionModel";
import { analyzeSafeTransactionRisk } from "../../src/chrome/safe/transactionRisk";
import { encodeMultiSendTransactions } from "../../src/chrome/safe/multiSend";

const execAbi = parseAbi(["function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)"]);
const multiAbi = parseAbi(["function multiSend(bytes transactions)"]);
const original = decodeFunctionData({ abi: execAbi, data: fixture.input as Hex }).args;
function execution(changes: Record<number, unknown> = {}) {
  const args = [...original];
  for (const [index, value] of Object.entries(changes)) args[Number(index)] = value as never;
  return encodeFunctionData({ abi: execAbi, functionName: "execTransaction", args: args as unknown as typeof original });
}
function multiSend(packed: Hex) {
  return encodeFunctionData({ abi: multiAbi, functionName: "multiSend", args: [packed] });
}

test("Monad regression unwraps Safe MultiSend into the original approval and contract call", () => {
  const result = decodeExplorerSafeExecution(fixture.input)!;
  assert.equal(result.calls?.length, 2);
  assert.equal(result.calls?.[0].to, "0xaca92e438df0b2401ff60da7e4337b687a2435da");
  assert.equal(result.calls?.[0].data?.slice(0, 10), "0x095ea7b3");
  assert.equal(result.calls?.[1].to, "0xb30755c750e0a7e5bed3ddaf0d9948cf2b1cdc87");
  assert.equal(result.calls?.[1].data?.slice(0, 10), "0x8b6099db");
  assert.deepEqual(result.calls?.map(call => call.value), ["0x0", "0x0"]);
  // Decoding supplied bytes must not grant the target a deployment exemption.
  assert.equal(analyzeSafeTransactionRisk(result.transaction, 143).delegatecall, true);
});

test("single Safe calls preserve their payment and gas reimbursement context", () => {
  const result = decodeExplorerSafeExecution(execution({ 1: 123n, 2: "0x", 3: 0, 6: 7n }))!;
  assert.deepEqual(result.calls, [{ to: original[0], value: "0x7b", data: "0x" }]);
  assert.equal(result.transaction.gasPrice, 7n);
  assert.ok(analyzeSafeTransactionRisk(result.transaction, 143).refund);
});

test("Safe decode rejects malformed, oversized and noncanonical envelopes", () => {
  for (const input of ["0x", "0x1234", fixture.input.slice(0, -2), fixture.input + "00", execution({ 3: 2 }), "0x" + "00".repeat(256 * 1024 + 1)]) {
    assert.equal(decodeExplorerSafeExecution(input), null);
  }
});

test("unsupported or partial batches never become a misleading CALL list", () => {
  const emptyCall = encodeMultiSendTransactions([{ to: original[0], value: "0", data: "0x", operation: 0 }]);
  for (const data of ["0x12345678", multiSend("0x"), multiSend(emptyCall.slice(0, -2) as Hex), multiSend(("0x01" + emptyCall.slice(4)) as Hex), (multiSend(emptyCall) + "00") as Hex]) {
    assert.equal(decodeExplorerSafeExecution(execution({ 2: data }))?.calls, null);
  }
  assert.equal(decodeExplorerSafeExecution(execution({ 1: 1n }))?.calls, null);
  const valid = decodeExplorerSafeExecution(execution({ 2: multiSend(emptyCall) }));
  assert.equal(valid?.calls?.[0].data, "0x");
});
