import assert from "node:assert/strict";
import test from "node:test";

import {
  RAW_ERC7710_DELEGATION_SIGNATURE_ERROR,
  validateEIP712TypedData,
} from "../../src/chrome/eip712Validator";

const delegation = {
  types: {
    EIP712Domain: [{ name: "chainId", type: "uint256" }],
    Caveat: [
      { name: "enforcer", type: "address" },
      { name: "terms", type: "bytes" },
    ],
    Delegation: [
      { name: "delegate", type: "address" },
      { name: "delegator", type: "address" },
      { name: "authority", type: "bytes32" },
      { name: "caveats", type: "Caveat[]" },
    ],
  },
  domain: { chainId: 1 },
  primaryType: "Delegation",
  message: {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0x2222222222222222222222222222222222222222",
    authority: `0x${"00".repeat(32)}`,
    caveats: [],
  },
};

test("raw ERC-7710 delegation typed data remains rejected with stable guidance", () => {
  for (const typedData of [delegation, JSON.stringify(delegation)]) {
    assert.deepEqual(validateEIP712TypedData("eth_signTypedData_v4", typedData), {
      valid: false,
      error: RAW_ERC7710_DELEGATION_SIGNATURE_ERROR,
    });
  }
});

test("methods outside the bounded v3/v4 parser retain their pass-through", () => {
  assert.deepEqual(validateEIP712TypedData("personal_sign", delegation), {
    valid: true,
  });
});

test("malformed field definitions reject cleanly before graph or delegation inspection", () => {
  for (const primaryType of ["Message", "Delegation"]) {
    for (const field of [null, 1, "field", { name: "x", type: 1 }, { name: "x", type: {} }]) {
      const data = { types: { EIP712Domain: [], [primaryType]: [field] }, domain: {}, primaryType, message: {} };
      for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"]) {
        for (const input of [data, JSON.stringify(data)]) {
          assert.equal(validateEIP712TypedData(method, input).valid, false);
        }
      }
    }
  }
});
