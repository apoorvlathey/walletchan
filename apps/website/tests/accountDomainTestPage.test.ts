import assert from "node:assert/strict";
import test from "node:test";
import { hashTypedData } from "viem";
import { accountDomainTestData, expectAccountDomainBlock } from "../app/test/sections/accountDomainTestUtils";

const address = "0x1111111111111111111111111111111111111111";

test("manual regression payloads are hashable and use the chosen account and chain", () => {
  for (const generic of [false, true]) {
    const data = accountDomainTestData(address, 8453, generic);
    assert.equal(data.domain.verifyingContract, address);
    assert.equal(data.domain.chainId, 8453);
    assert.match(hashTypedData(data as never), /^0x[0-9a-f]{64}$/);
  }
  const data = accountDomainTestData(address, 1);
  assert.equal(data.primaryType, "PackedUserOperation");
  assert.equal(data.message.callData, "0x");
  assert.equal(BigInt(data.message.accountGasLimits!), 0n);
});

test("PASS requires the exact policy rejection, not user rejection or RPC failure", async () => {
  const result = await expectAccountDomainBlock(async () => {
    throw new Error("External signature requests cannot use wallet accounts as the verifying contract. Use a reviewed transaction or permission request instead.");
  });
  assert.equal(result.status, "PASS");
  for (const error of [new Error("User rejected the request"), { code: 4001, message: "User rejected" }, new Error("RPC unavailable")]) {
    await assert.rejects(expectAccountDomainBlock(async () => { throw error; }), /INCONCLUSIVE/);
  }
});

test("an unexpected signature fails without displaying it", async () => {
  await assert.rejects(expectAccountDomainBlock(async () => "secret-signature"), (error: Error) => {
    assert.match(error.message, /^FAIL:/);
    assert.ok(!error.message.includes("secret-signature"));
    return true;
  });
});
