import assert from "node:assert/strict";
import test from "node:test";
import { hashTypedData, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { INTERNAL_ACCOUNT_TYPED_DATA_ERROR, validateEIP712TypedData } from "../../src/chrome/eip712Validator";
import { signaturePassesSurfacePreflight } from "../../src/chrome/provider/contentBridge/requestSurfaceSignaturePreflight";
import { signMetaMaskUserOperation, getMetaMaskUserOperationTypedData } from "../../src/chrome/feePayment/userOperation";
import { accountExecutionTypedData } from "./accountDomainFixture";

const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const other = "0x1111111111111111111111111111111111111111";

test("external V3/V4 rejects execution signatures, irrespective of encoding, type name, or call fields", () => {
  for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"]) {
    for (const name of ["PackedUserOperation", "Execute", "Login"]) {
      const data = accountExecutionTypedData(address);
      data.types[name] = data.types.PackedUserOperation;
      if (name !== "PackedUserOperation") delete data.types.PackedUserOperation;
      data.primaryType = name;
      data.domain.verifyingContract = `0x${address.slice(2).toUpperCase()}`;
      for (const input of [data, JSON.stringify(data)]) {
        assert.deepEqual(validateEIP712TypedData(method, input, [other, address]), {
          valid: false, error: INTERNAL_ACCOUNT_TYPED_DATA_ERROR,
        });
        assert.equal(signaturePassesSurfacePreflight(method, [address, input], 1), false);
      }
    }
    const noCalls = { types: { EIP712Domain: [{ name: "verifyingContract", type: "address" }], Login: [] }, domain: { verifyingContract: address }, primaryType: "Login", message: {} };
    assert.equal(validateEIP712TypedData(method, noCalls, [address]).valid, false);
  }
});

test("third-party contract signatures and personal_sign remain available", () => {
  const data = accountExecutionTypedData(other);
  const result = validateEIP712TypedData("eth_signTypedData_v4", data, [address]);
  assert.equal(result.valid, true);
  assert.equal(hashTypedData(JSON.parse(result.sanitized!)), hashTypedData(data));
  delete data.domain.verifyingContract;
  assert.equal(validateEIP712TypedData("eth_signTypedData_v4", data, [address]).valid, true);
  assert.equal(validateEIP712TypedData("personal_sign", "0x1234", [address]).valid, true);
  assert.equal(validateEIP712TypedData("eth_signTypedData_v4", "null", [address]).valid, false);
});

test("ordinary permit and nested batch signatures preserve their exact signing digest", async () => {
  const signer = privateKeyToAccount(`0x${"01".repeat(32)}`);
  const domain = { name: "Token", version: "1", chainId: 1, verifyingContract: other };
  const permit = {
    domain,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" }, { name: "version", type: "string" },
        { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
      ],
      Permit: [
        { name: "owner", type: "address" }, { name: "spender", type: "address" },
        { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: signer.address, spender: address, value: "1", nonce: "0", deadline: "2000000000" },
  };
  const batch = {
    domain,
    types: {
      EIP712Domain: permit.types.EIP712Domain,
      TokenPermissions: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
      PermitBatchTransferFrom: [
        { name: "permitted", type: "TokenPermissions[]" }, { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "PermitBatchTransferFrom",
    message: { permitted: [{ token: other, amount: "1" }], spender: address, nonce: "0", deadline: "2000000000" },
  };
  for (const data of [permit, batch]) {
    for (const explicitDomainType of [true, false]) {
      const payload: any = structuredClone(data);
      if (!explicitDomainType) delete payload.types.EIP712Domain;
      for (const input of [payload, JSON.stringify(payload)]) {
        const result = validateEIP712TypedData("eth_signTypedData_v4", input, [signer.address, address]);
        assert.equal(result.valid, true, result.error);
        const sanitized = JSON.parse(result.sanitized!);
        assert.equal(hashTypedData(sanitized), hashTypedData(payload));
        const signature = await signer.signTypedData(sanitized);
        assert.equal(await recoverTypedDataAddress({ ...payload, signature }), signer.address);
      }
    }
  }
});

test("reviewed internal UserOperations still produce the correct execution signature", async () => {
  const key = `0x${"01".repeat(32)}` as const;
  const signer = privateKeyToAccount(key);
  const op = { sender: signer.address, nonce: "0x0", callData: "0x", callGasLimit: "0x100", verificationGasLimit: "0x100", preVerificationGas: "0x100", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1" } as const;
  const signature = await signMetaMaskUserOperation(key, op, 1);
  assert.equal(await recoverTypedDataAddress({ ...getMetaMaskUserOperationTypedData(op, 1), signature }), signer.address);
  assert.equal(validateEIP712TypedData("eth_signTypedData_v4", accountExecutionTypedData(signer.address), [signer.address]).valid, false);
});
