import { createPublicClient, type PublicClient } from "viem";
import { getStoredRpcUrl } from "@/lib/chains";
import { secureHttpTransport } from "../network/rpcClient";

/** Timestamp enrichment must never prevent applying an already verified receipt. */
export async function resolveSafeExecutionTime(input: {
  chainId: number;
  blockNumber: unknown;
  client?: Pick<PublicClient, "getBlock">;
  fallback?: number;
}): Promise<number> {
  const fallback = input.fallback ?? Date.now();
  try {
    const number = input.blockNumber;
    if (typeof number !== "bigint" && !(typeof number === "string" && /^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(number))) return fallback;
    const rpcUrl = input.client ? null : await getStoredRpcUrl(input.chainId);
    const client = input.client ?? (rpcUrl ? createPublicClient({
      transport: secureHttpTransport(rpcUrl, { timeout: 4_000, retryCount: 0 }),
    }) : null);
    if (!client) return fallback;
    const block = await client.getBlock({ blockNumber: BigInt(number) });
    const time = Number(block.timestamp) * 1000;
    return Number.isSafeInteger(time) && time > 0 ? time : fallback;
  } catch {
    return fallback;
  }
}
