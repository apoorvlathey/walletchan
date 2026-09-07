import { validateRecoveredMessage } from "./receiptValidation";
import { type Hash } from "viem";
import type { CompletedTransaction, ForceInclusionMeta } from "../txHistoryStorage";
import { updateTxInHistory } from "../txHistoryStorage";
import { buildForceInclusionL1GasData, isForceInclusionL1GasData } from "../forceInclusion/l1GasData";
import { createL1PublicClient, getL1RpcUrl } from "../forceInclusion/l1Client";
import { startReceiptPolling } from "../forceInclusion/receiptPoller";
import {
  ARBITRUM_SEQUENCER_INBOX_ABI,
  decodeDeliveredMessage,
  decodeInboxMessage,
} from "./contracts";

export async function recoverArbitrumForceInclusion(tx: CompletedTransaction) {
  const meta = tx.forceInclusionMeta;
  if (!meta || meta.protocol !== "arbitrum") return;
  if (tx.status === "success" && isForceInclusionL1GasData(tx.gasData)) return;
  const childHash = meta.l2TxHash || (tx.txHash !== meta.l1TxHash ? tx.txHash : undefined);
  if (tx.status === "failed" || tx.status === "dropped") {
    if (tx.status === "dropped" && childHash) {
      await updateTxInHistory(tx.id, {
        status: "pending",
        error: undefined,
        completedAt: undefined,
      });
      startReceiptPolling(tx.id, childHash, meta.l2ChainId);
    }
    return;
  }
  if (!meta.l1TxHash) return;
  const client = createL1PublicClient(await getL1RpcUrl(meta.l1ChainId));
  const receipt = await client
    .getTransactionReceipt({ hash: meta.l1TxHash as Hash })
    .catch(() => null);
  if (!receipt) return;
  if (receipt.status === "reverted") {
    if (tx.status === "success") return;
    await updateTxInHistory(tx.id, {
      status: "failed",
      broadcastUncertain: false,
      error: "L1 delayed-inbox transaction reverted onchain",
      completedAt: Date.now(),
    });
    return;
  }
  // Completed L2 transactions only need missing L1 gas accounting, not a force preimage.
  if (tx.status === "success") {
    await updateTxInHistory(tx.id, {
      gasData: buildForceInclusionL1GasData(receipt, meta.l1ChainId),
    });
    return;
  }
  let recoveredMeta: ForceInclusionMeta = meta;
  if (
    !meta.messageIndex &&
    meta.bridge &&
    meta.inbox &&
    meta.sequencerInbox
  ) {
    const delivered = decodeDeliveredMessage(receipt, meta.bridge, meta.inbox);
    const inboxMessage = decodeInboxMessage(receipt, meta.inbox);
    validateRecoveredMessage(delivered, inboxMessage, tx.tx.from, childHash);
    const deadline = await client.readContract({
      address: meta.sequencerInbox,
      abi: ARBITRUM_SEQUENCER_INBOX_ABI,
      functionName: "forceInclusionDeadline",
      args: [receipt.blockNumber],
    });
    recoveredMeta = {
      ...meta,
      messageIndex: delivered.messageIndex.toString(),
      messageBlockNumber: receipt.blockNumber.toString(),
      messageBlockHash: receipt.blockHash,
      messageTimestamp: delivered.timestamp.toString(),
      kind: delivered.kind,
      sender: delivered.sender as `0x${string}`,
      baseFeeL1: delivered.baseFeeL1.toString(),
      messageDataHash: delivered.messageDataHash,
      forceDeadlineBlock: deadline.toString(),
    };
  }
  await updateTxInHistory(tx.id, {
    status: tx.status === "processing" ? "pending" : tx.status,
    ...(childHash ? { txHash: childHash } : {}),
    broadcastUncertain: false,
    gasData: buildForceInclusionL1GasData(receipt, meta.l1ChainId),
    forceInclusionMeta: recoveredMeta,
  });
  if (childHash) {
    startReceiptPolling(tx.id, childHash, meta.l2ChainId);
  }
}
