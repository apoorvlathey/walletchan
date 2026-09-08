import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, parseAbi } from "viem";
import { validateServiceTransaction } from "../../src/chrome/safe/serviceValidation";
import { buildSafeTransactionTypedData, computeSafeTransactionHash } from "../../src/chrome/safe/transactionHash";
import { analyzeSafeTransactionRisk } from "../../src/chrome/safe/transactionRisk";
import { buildSafeExecutionData } from "../../src/chrome/safe/executionData";
import type { SafeChainSnapshot, SafeTransactionData } from "../../src/chrome/safe/types";

const EXEC_ABI = parseAbi(["function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)"]);
const safe = "0x1111111111111111111111111111111111111111" as const;
const zero = "0x0000000000000000000000000000000000000000" as const;
test("imported refund-bearing rejection proposals retain their hash, signing fields and execution payment", async () => {
  for (const gasToken of [zero, safe]) {
    const transaction: SafeTransactionData = { to: safe, value: "0", data: "0x", operation: 0,
      safeTxGas: "100000", baseGas: "21000", gasPrice: "1000000000", gasToken,
      refundReceiver: zero, nonce: 0 };
    const input = { chainId: 1, safeAddress: safe, safeVersion: "1.4.1" as const, transaction };
    const hash = computeSafeTransactionHash(input);
    const proposal = await validateServiceTransaction({
      value: { ...transaction, safe, safeTxHash: hash, confirmations: [] },
      safeAddress: safe, safeAccountId: "safe",
      snapshot: { chainId: 1, version: "1.4.1", owners: [], threshold: 1, nonce: "0",
        configEpoch: "fixture", verifiedAtBlock: "1" } as unknown as SafeChainSnapshot,
    });
    assert.equal(proposal.purpose, "rejection");
    assert.equal(proposal.safeTxHash, hash);
    assert.deepEqual(proposal.transaction, transaction);
    assert.deepEqual(analyzeSafeTransactionRisk(proposal.transaction, 1).refund,
      { gasToken, refundReceiver: zero });
    assert.deepEqual(buildSafeTransactionTypedData({ ...input, transaction: proposal.transaction }).message, transaction);
    const decoded = decodeFunctionData({ abi: EXEC_ABI, data: buildSafeExecutionData(proposal) });
    assert.deepEqual(decoded.args.slice(4, 9), [100000n, 21000n, 1000000000n, gasToken, zero]);
    assert.equal(computeSafeTransactionHash({ ...input, transaction: proposal.transaction }), hash);
  }
});
