import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { encodeFunctionData, parseAbi } from "viem";
import { detectAbiEncodingError } from "../../src/lib/calldataValidation";
import { validateTransactionPayload } from "../../src/chrome/provider/transactionValidation";
import { validateWalletSendCallsPayload } from "../../src/chrome/provider/batchValidation";

import { providerRequestPassesSurfacePreflight } from "../../src/chrome/provider/contentBridge/requestSurfacePreflight";
import { validateWalletConnectRequestPayload } from "../../src/chrome/walletConnect/requestValidation";

const to = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const spender = "0x9bd89d602f42724de67ce267f4b79581e719a1e3";
const dirty = "0xd73dd6230000100000000000000000009bd89d602f42724de67ce267f4b79581e719a1e3" + "f".repeat(64);

test("reported bytes pass hex validation but ethers fails when reading the spender", () => {
  const decoded = new Interface(["function increaseApproval(address,uint256)"]).parseTransaction({ data: dirty });
  assert.ok(decoded);
  assert.throws(() => decoded.args[0], /deferred error/);
  assert.equal(detectAbiEncodingError(dirty).malformed, true);
  assert.equal(validateTransactionPayload({ to, data: dirty, value: "0x0" }).valid, false);
  // Literal report has separate transport errors; neither demonstrates ABI protection.
  assert.equal(validateTransactionPayload({ to, data: dirty + " ", value: "0x0" }).valid, false);
  assert.equal(validateTransactionPayload({ to, data: "0x", value: 0 }).valid, false);
});

for (const name of ["approve", "transfer", "increaseAllowance", "decreaseAllowance", "increaseApproval", "decreaseApproval"]) {
  test(`${name}: canonical allowed; every high address byte rejected in singles and batches`, () => {
    const data = encodeFunctionData({ abi: parseAbi([`function ${name}(address,uint256)`]), functionName: name, args: [spender, 1n] });
    assert.equal(detectAbiEncodingError(data).functionName, name);
    assert.equal(validateTransactionPayload({ to, data }).valid, true);
    assert.equal(validateWalletSendCallsPayload({ calls: [{ to, data }] }).valid, true);
    for (let byte = 0; byte < 12; byte++) {
      const offset = 10 + byte * 2;
      const malformed = data.slice(0, offset) + "01" + data.slice(offset + 2);
      assert.equal(detectAbiEncodingError(malformed).malformed, true);
      assert.equal(validateTransactionPayload({ to, data: malformed }).valid, false);
      assert.equal(validateWalletSendCallsPayload({ calls: [{ to, data }, { to, data: malformed }] }).valid, false);
    }
    for (const malformed of [data.slice(0, -2), data + "00", data.slice(0, -1) + "g"]) {
      assert.equal(detectAbiEncodingError(malformed).malformed, true);
    }
  });
}

test("unknown selectors and contract initcode are outside the known-call policy", () => {
  assert.equal(validateTransactionPayload({ to, data: "0xdeadbeef" }).valid, true);
  assert.equal(validateTransactionPayload({ data: dirty }).valid, true);
});


test("dirty legacy approvals cannot open signer review for any account type", () => {
  for (const accountType of ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"]) {
    assert.equal(providerRequestPassesSurfacePreflight("i_sendTransaction", {
      id: "legacy-padding", from: spender, to, data: dirty, value: "0x0", chainId: 1,
    }, { address: spender, accountType, chainId: 1, dappConnected: true }), false, accountType);
  }
  assert.equal(validateWalletConnectRequestPayload("eth_sendTransaction", [{ from: spender, to, data: dirty, value: "0x0" }]).valid, false);
  assert.equal(validateWalletConnectRequestPayload("wallet_sendCalls", [{ calls: [{ to, data: dirty }] }]).valid, false);
});
