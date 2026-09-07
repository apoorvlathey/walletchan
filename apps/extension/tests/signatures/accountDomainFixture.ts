import { encodeMetaMaskDeleGatorCalls, getMetaMaskUserOperationTypedData } from "../../src/chrome/feePayment/userOperation";
import { buildSafeTransactionTypedData } from "../../src/chrome/safe/transactionHash";

export function safeTransactionTypedData(safeAddress: `0x${string}`) {
  return buildSafeTransactionTypedData({
    chainId: 1,
    safeAddress,
    safeVersion: "1.4.1",
    transaction: {
      to: safeAddress, value: "0", data: "0x", operation: 0,
      safeTxGas: "0", baseGas: "0", gasPrice: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      nonce: 0,
    },
  });
}

export function accountExecutionTypedData(sender: `0x${string}`) {
  const data = getMetaMaskUserOperationTypedData({
    sender, nonce: "0x0",
    callData: encodeMetaMaskDeleGatorCalls(sender, [{
      to: "0x2222222222222222222222222222222222222222", value: 1n, data: "0x",
    }]),
    callGasLimit: "0x186a0", verificationGasLimit: "0x186a0",
    preVerificationGas: "0xc350", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1",
  }, 1);
  return JSON.parse(JSON.stringify({
    ...data,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" }, { name: "version", type: "string" },
        { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
      ],
      ...data.types,
    },
  }, (_, value) => typeof value === "bigint" ? value.toString() : value));
}
