import { namehash, parseAbi, type PublicClient } from "viem";
import { getStoredRpcUrl } from "@/lib/chains";
import { GWEI_CONTRACT } from "@/utils/wei";
import { fetchPinAndCacheErc4804 } from "./erc4804Resolver";
import { describeResolverError, getDirectClient } from "./resolverSupport";
import { getEnsBrowsingSettings } from "./settingsStorage";
import type { ResolveResponse } from "./types";
import { fetchErc4804, type Web3FetchResult } from "./web3url";

const ABI = parseAbi([
  "function text(bytes32 node, string key) view returns (string)",
]);

export function parseGweiContentContract(record: string) {
  const match = /^(?:(eth|sep):)?(0x[a-fA-F0-9]{40})$/.exec(record.trim());
  if (!match || /^0x0+$/.test(match[2])) return null;
  return {
    chainId: match[1] === "sep" ? 11155111 : 1,
    address: match[2].toLowerCase() as `0x${string}`,
  };
}

/** Match GNS's 5219/manual modes; local snapshots serve only the root HTML. */
export async function fetchGweiHtml(
  client: PublicClient,
  address: `0x${string}`,
): Promise<Web3FetchResult> {
  const result = await fetchErc4804(client, address, { gnsGateway: true });
  if (
    !result.body.length ||
    !/^\s*text\/html(?:\s*;|\s*$)/i.test(result.contentType ?? "text/html")
  ) {
    throw new Error("GNS website must return nonempty HTML.");
  }
  return result;
}

export async function resolveGweiContract(
  client: PublicClient,
  ensName: string,
): Promise<ResolveResponse> {
  try {
    const record = await client.readContract({
      address: GWEI_CONTRACT,
      abi: ABI,
      functionName: "text",
      args: [namehash(ensName), "contentcontract"],
    });
    const target = parseGweiContentContract(record);
    if (!target)
      return {
        ok: false,
        error: `${ensName} has no valid website contentcontract set.`,
      };
    const settings = await getEnsBrowsingSettings();
    if (settings.useLocalGateway && settings.pinOnchainHtml) {
      const rpc = await getStoredRpcUrl(target.chainId);
      if (!rpc)
        return {
          ok: false,
          error: `No RPC configured for GNS content chain ${target.chainId}.`,
        };
      return fetchPinAndCacheErc4804(
        getDirectClient(rpc),
        target.address,
        ensName,
        true,
        fetchGweiHtml,
      );
    }
    return {
      ok: true,
      kind: "web3",
      value: target.address,
      ensName,
      trustedDirectly: true,
      contractAddress: target.address,
    };
  } catch (error) {
    return {
      ok: false,
      error: `GNS contentcontract resolution failed: ${describeResolverError(error)}`,
    };
  }
}
