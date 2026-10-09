import { createPublicClient, type Chain } from "viem";
import type { PendingTxRequest } from "../requests/pendingTxStorage";
import { getRpcUrl } from "../transactions/rpcConfig";
import { secureHttpTransport } from "../network/rpcClient";
import { DEFAULT_L2_GAS } from "./deposit";
import { L1_RPC_TIMEOUT } from "./l1Client";

/** Preserve the conservative fallback when the L2 cannot estimate a deposit. */
export async function estimateSingleL2Gas(tx: PendingTxRequest["tx"], chain: Chain): Promise<bigint> {
  const l2RpcUrl = await getRpcUrl(tx.chainId);
  if (!l2RpcUrl) throw new Error("No RPC URL for L2 chain");
  const l2Client = createPublicClient({
    chain: chain,
    transport: secureHttpTransport(l2RpcUrl, { timeout: L1_RPC_TIMEOUT }),
  });
  const value =
    tx.value && tx.value !== "0x0"
      ? BigInt(tx.value)
      : 0n;
  let l2Gas = DEFAULT_L2_GAS;
  try {
    const estimated = await l2Client.estimateGas({
      account: tx.from as `0x${string}`,
      to: tx.to as `0x${string}` | undefined,
      value,
      data: (tx.data as `0x${string}`) || undefined,
    });
    l2Gas = (estimated * 120n) / 100n;
  } catch {
    // Preserve the conservative default when L2 estimation fails.
  }

  return l2Gas;
}
