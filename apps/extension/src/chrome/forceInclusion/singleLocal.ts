import { estimateSingleL2Gas } from "./singleGasEstimation";
import { writeResultToStorage } from "../transactions/runtime";
import { createWalletClient, type Hash, type TransactionReceipt } from "viem";
import { localForceInclusionSigner, type RawForceInclusionSigner } from "../forceInclusion/rawSigner";
import { FORCE_INCLUSION_CHAINS } from "@/constants/chainRegistry";
import { secureHttpTransport } from "../network/rpcClient";
import {
  capturePendingRequestAuthorizationCommitSnapshot,
  enforcePendingRequestAuthorizationAtConfirmation,
} from "../requests/pendingRequestLifecycle";
import {
  guardPendingRequestEffectLease,
  type PendingRequestEffectLease,
} from "../requests/pendingRequestResolution";
import type { PendingTxRequest } from "../requests/pendingTxStorage";
import { updateTxInHistory } from "../txHistoryStorage";
import { buildL1DepositTxParams } from "./deposit";
import {
  createL1PublicClient,
  getL1Chain,
  getL1RpcUrl,
  L1_RECEIPT_TIMEOUT,
  L1_RPC_TIMEOUT,
} from "./l1Client";
import {
  createSingleProgressWriter,
  initializeSingleForceInclusionHistory,
} from "./singleHistory";
import {
  extractL2Hash,
  finishSingleForceInclusion,
  retainPendingSingleBroadcast,
  writeSingleForceInclusionFailure,
} from "./singleOutcome";
import type {
  ForceInclusionAccount,
  ForceInclusionLifecycle,
  ForceInclusionGasOverrides,
} from "./types";

export async function processForceInclusionLocal(
  txId: string,
  pending: PendingTxRequest,
  account: ForceInclusionAccount,
  privateKey: `0x${string}` | RawForceInclusionSigner,
  gasOverrides?: ForceInclusionGasOverrides,
  effectLease?: PendingRequestEffectLease,
  lifecycle?: ForceInclusionLifecycle,
): Promise<void> {
  const info = FORCE_INCLUSION_CHAINS.get(pending.tx.chainId);
  if (!info) {
    await writeSingleForceInclusionFailure(
      txId,
      "Chain does not support force inclusion",
    );
    lifecycle?.failed("Chain does not support force inclusion");
    effectLease?.release();
    return;
  }
  if (info.protocol !== "op-stack") {
    await writeSingleForceInclusionFailure(txId, "Invalid OP Stack force-inclusion route");
    lifecycle?.failed("Chain does not support force inclusion");
    effectLease?.release();
    return;
  }
  const effectGuard = guardPendingRequestEffectLease(effectLease);
  const progress = createSingleProgressWriter(txId, info, pending.tx.chainId);

  let historyInitialized = false;
  let submittedHash: string | undefined;
  let resultHash: string | undefined;
  try {
    const signer = typeof privateKey === "string" ? localForceInclusionSigner(privateKey) : privateKey;
    if (!lifecycle) {
      await initializeSingleForceInclusionHistory(txId, pending, info, account);
      historyInitialized = true;
    }
    await progress("building");
    const l2Gas = await estimateSingleL2Gas(pending.tx, info.viemChain);

    await progress("submitting");
    const l1RpcUrl = await getL1RpcUrl(info.l1ChainId);
    const l1Chain = getL1Chain(info.l1ChainId);
    const viemAccount = signer.account;
    const l1PublicClient = createL1PublicClient(l1RpcUrl);
    const l1TxParams = await buildL1DepositTxParams(pending.tx, info, l2Gas);
    const nonce = await l1PublicClient.getTransactionCount({
      address: viemAccount.address,
      blockTag: "pending",
    });
    const wallet = createWalletClient({
      account: viemAccount,
      chain: l1Chain,
      transport: secureHttpTransport(l1RpcUrl, { timeout: L1_RPC_TIMEOUT }),
    });

    const authorization = await enforcePendingRequestAuthorizationAtConfirmation(
      "transaction",
      pending,
    );
    if (!authorization.authorized) throw new Error(authorization.error);
    const broadcast = await signer.broadcast(
      wallet,
      {
        account: viemAccount,
        chain: l1Chain,
        to: l1TxParams.to as `0x${string}`,
        data: l1TxParams.data as `0x${string}`,
        value:
          l1TxParams.value && l1TxParams.value !== "0x0"
            ? BigInt(l1TxParams.value)
            : 0n,
        nonce,
        ...(gasOverrides
          ? {
              gas: BigInt(gasOverrides.gasLimit),
              maxFeePerGas: BigInt(gasOverrides.maxFeePerGas),
              maxPriorityFeePerGas: BigInt(
                gasOverrides.maxPriorityFeePerGas,
              ),
            }
          : {}),
      },
      {
        chainId: info.l1ChainId,
        supportsSyncSend: false,
        beforeBroadcast: async ({ transactionHash }) => {
          const authorizationSnapshot = await capturePendingRequestAuthorizationCommitSnapshot(pending);
          const { getAccountById } = await import("../accountStorage");
          const latest = await getAccountById(account.id);
          if (
            !latest ||
            latest.type !== account.type ||
            latest.address.toLowerCase() !== account.address.toLowerCase()
          ) {
            throw new Error("Pending request account is no longer available");
          }
          const finalAuthorization =
            await enforcePendingRequestAuthorizationAtConfirmation(
              "transaction",
              pending,
            );
          if (!finalAuthorization.authorized) {
            throw new Error(finalAuthorization.error);
          }
          await signer.assertAvailable();
          if (lifecycle) {
            await lifecycle.beforeBroadcast();
            await initializeSingleForceInclusionHistory(txId, pending, info, account);
            historyInitialized = true;
          }
          // Persist the deterministic parent hash before the irreversible send.
          await updateTxInHistory(txId, {
            status: "pending", broadcastUncertain: true,
            txHash: transactionHash,
            forceInclusionMeta: { l1TxHash: transactionHash, l1ChainId: info.l1ChainId, l2ChainId: pending.tx.chainId, l2Confirmed: false },
          });
          await signer.assertAvailable();
          // A disconnect/reconnect during history or account reads invalidates
          // this approval even if the connection is authorized again now.
          if (!authorizationSnapshot.isCurrent()) {
            throw new Error("Request authorization changed before broadcast");
          }
          effectGuard.beginEffect();
        },
      },
    );
    const l1Hash = broadcast.txHash;
    submittedHash = l1Hash;
    resultHash = l1Hash;
    await updateTxInHistory(txId, {
      status: "pending",
      txHash: l1Hash,
      broadcastUncertain: broadcast.broadcastUncertain === true,
      forceInclusionMeta: {
        l1TxHash: l1Hash,
        l1ChainId: info.l1ChainId,
        l2ChainId: pending.tx.chainId,
        l2Confirmed: false,
      },
    });
    effectGuard.settleEffect();
    effectGuard.releaseIfSafe();
    lifecycle?.submitted();

    await progress("waiting-l1", { l1Hash });
    let receipt: TransactionReceipt;
    try {
      receipt = await l1PublicClient.waitForTransactionReceipt({
        hash: l1Hash as Hash,
        timeout: L1_RECEIPT_TIMEOUT,
      });
    } catch (error) {
      await retainPendingSingleBroadcast(
        txId,
        pending,
        info,
        l1Hash,
        broadcast.broadcastUncertain === true,
        progress,
        error,
      );
      return;
    }
    if (receipt.status === "reverted") {
      const error = "L1 deposit transaction reverted onchain";
      await progress("error", { error });
      await writeSingleForceInclusionFailure(txId, error);
      return;
    }
    await finishSingleForceInclusion(
      txId,
      pending,
      info,
      l1Hash,
      extractL2Hash(receipt),
      receipt,
      progress,
    );
  } catch (error: any) {
    effectGuard.releaseIfSafe();
    if (submittedHash) {
      // The pre-send history already owns recovery. Never turn a bookkeeping
      // or notification error into a retryable second send.
      effectGuard.settleEffect();
      effectGuard.releaseIfSafe();
      lifecycle?.submitted();
      await writeResultToStorage(`txResult:${txId}`, { success: true, txHash: resultHash }).catch(() => undefined);
      return;
    }
    const message =
      error?.shortMessage || error?.message || "Force inclusion failed";
    await progress("error", { error: message });
    if (historyInitialized) await writeSingleForceInclusionFailure(txId, message);
    lifecycle?.failed(message);
  }
}
