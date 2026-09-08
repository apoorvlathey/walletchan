import { FORCE_INCLUSION_CHAINS } from "@/constants/chainRegistry";
import { processArbitrumForceInclusionLocal } from "../arbitrumForceInclusion/single";
import { processForceInclusionLocal } from "../forceInclusion/singleLocal";
import { createRawForceInclusionSigner } from "../forceInclusion/rawSigner";
import type { ForceInclusionGasOverrides } from "../forceInclusion/types";
import type { PendingRequestEffectLease } from "../requests/pendingRequestResolution";
import { removePendingTxRequest, type PendingTxRequest } from "../requests/pendingTxStorage";
import { activeAbortControllers, processingTxIds } from "../transactions/runtime";
import type { LedgerAccount } from "../types";
import { cancelLedgerOperation } from "./offscreenBridge";

/** Keep device prompts retryable; return to progress as soon as the L1 hash is tracked. */
export async function processLedgerForceInclusion(input: {
  txId: string;
  pending: PendingTxRequest;
  account: LedgerAccount;
  gasOverrides?: ForceInclusionGasOverrides;
  effectLease: PendingRequestEffectLease;
}): Promise<{ success: boolean; error?: string }> {
  const { txId, pending, account, gasOverrides, effectLease } = input;
  const abortController = new AbortController();
  activeAbortControllers.set(txId, abortController);
  abortController.signal.addEventListener("abort", () => {
    void cancelLedgerOperation(txId).catch(() => undefined);
  }, { once: true });
  try {
    const signer = await createRawForceInclusionSigner({ account, opId: txId, signal: abortController.signal });
    const processor = FORCE_INCLUSION_CHAINS.get(pending.tx.chainId)?.protocol === "arbitrum"
      ? processArbitrumForceInclusionLocal : processForceInclusionLocal;
    return await new Promise((resolve) => {
      void processor(txId, pending, account, signer, gasOverrides, effectLease, {
        beforeBroadcast: () => removePendingTxRequest(txId),
        submitted: () => resolve({ success: true }),
        failed: (error) => resolve({ success: false, error }),
      }).catch((error) => {
        // Unexpected storage errors must still release the UI waiter. The
        // processor retains an unsettled effect lease after a possible send.
        resolve({ success: false, error: error instanceof Error ? error.message : "Force inclusion failed" });
      });
    });
  } catch (error) {
    effectLease.release();
    return { success: false, error: error instanceof Error ? error.message : "Force inclusion failed" };
  } finally {
    activeAbortControllers.delete(txId);
    processingTxIds.delete(txId);
  }
}
