import assert from "node:assert/strict";
import test from "node:test";
import { hashTypedData } from "viem";
import { normalizeBankrTypedDataChainId as normalize } from "../../src/chrome/bankr/typedData";

const payload = (chainId: unknown) => ({
  domain: { name: "WalletChan chain ID test", chainId },
  types: {
    EIP712Domain: [{ name: "name", type: "string" }, { name: "chainId", type: "uint256" }],
    TestMessage: [{ name: "contents", type: "string" }],
  },
  primaryType: "TestMessage",
  message: { contents: "No spending authorization" },
});

test("Bankr conversion preserves exact hashes and never mutates reviewed data", () => {
  for (const chainId of [1, 8453, "8453", "0x2105", "0X2105", "0008453", 8453n, String(Number.MAX_SAFE_INTEGER)]) {
    const input = payload(chainId);
    Object.freeze(input.domain);
    Object.freeze(input);
    const output = normalize(input) as ReturnType<typeof payload>;
    assert.equal(output.domain.chainId, Number(BigInt(chainId)));
    assert.equal(input.domain.chainId, chainId);
    assert.equal(output.message, input.message);
    assert.equal(output.types, input.types);
    assert.equal(hashTypedData(output as never), hashTypedData(input as never));
  }
});

test("Bankr rejects malformed, null, fractional, non-positive and unsafe IDs", () => {
  for (const chainId of [null, true, {}, [], 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "", "0", "-1", "1.5", "1e3", " 8453", "8453 ", "0x", "0xzz", "0x0", "9007199254740992", 0n, -1n]) {
    assert.throws(() => normalize(payload(chainId)), /chainId/);
  }
  for (const input of [null, [], "{}", {}, { domain: null }, { domain: [] }]) {
    assert.throws(() => normalize(input), /Invalid EIP-712/);
  }
});

test("an omitted EIP-712 chain ID stays omitted", () => {
  const input = { domain: { name: "Chain independent" }, types: {}, message: {} };
  assert.equal(normalize(input), input);
  assert.equal("chainId" in input.domain, false);
});
