import type { PendingSignatureRequest } from "@/chrome/requests/pendingSignatureStorage";
import type { SafeProposalRecord, SafeTransactionData } from "@/chrome/safe/types";
import { buildSafeTransactionTypedData } from "@/chrome/safe/transactionHash";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const TARGET = "0x1111111111111111111111111111111111111111" as const;
const SAFE = "0x3a11e7c2ccd1af51c1edd664800af20d21ee5d34" as const;

/** Renderer-only fixtures; no live Safe or signing/submission transport. */
export function applySafeSignatureScenario(
  request: PendingSignatureRequest,
  scenario: string,
): PendingSignatureRequest {
  if (!scenario.startsWith("safe-")) return request;
  const warning = scenario === "safe-warnings";
  const transaction: SafeTransactionData = {
    to: TARGET, value: "0", data: "0x", operation: warning ? 1 : 0,
    safeTxGas: "0", baseGas: "21000", gasPrice: warning ? "1" : "0",
    gasToken: ZERO, refundReceiver: ZERO, nonce: 4,
  };
  const typedData = buildSafeTransactionTypedData({
    chainId: 8453, safeAddress: SAFE, safeVersion: "1.4.1", transaction,
  });
  return {
    ...request,
    origin: "https://app.safe.global",
    senderOrigin: "https://app.safe.global",
    signature: {
      method: "eth_signTypedData_v4",
      params: [request.accountAddress, JSON.stringify(typedData)],
      chainId: 8453,
    },
  };
}

export function applySafeRefundScenario(
  proposal: SafeProposalRecord,
  scenario: string,
): SafeProposalRecord {
  if (scenario !== "refund-approval" && scenario !== "refund-execution") return proposal;
  return {
    ...proposal,
    state: scenario === "refund-approval" ? "draft" : "readyToExecute",
    confirmations: scenario === "refund-approval" ? [] : proposal.confirmations,
    transaction: {
      ...proposal.transaction,
      baseGas: "21000", gasPrice: "1", gasToken: ZERO, refundReceiver: ZERO,
    },
  };
}
