import { decode, getCodec } from "@ensdomains/content-hash";
import { namehash, parseAbi, type PublicClient } from "viem";

import { getStoredRpcUrl } from "@/lib/chains";
import { WEI_CONTRACT } from "@/utils/wei";
import { fetchPinAndCacheErc4804 } from "./erc4804Resolver";
import {
  describeResolverError,
  getDirectClient,
  RESOLVER_ABI,
} from "./resolverSupport";
import { getEnsBrowsingSettings } from "./settingsStorage";
import type { ResolveResponse } from "./types";
import type { Web3FetchResult } from "./web3url";

const HTML_ABI = parseAbi(["function html() view returns (string)"]);
const MAX_HTML_BYTES = 1024 * 1024;

export function isWeiName(name: string): boolean {
  return /^(?:[a-z0-9-]+\.)+wei\.?$/i.test(name);
}

/** WNS's wei.limo gateway reads html() from the resolved contract. */
export async function fetchWeiHtml(
  client: PublicClient,
  address: `0x${string}`,
): Promise<Web3FetchResult> {
  const code = await client.getCode({ address });
  if (!code || code === "0x") throw new Error("WNS address is not a contract.");
  const html = await client.readContract({
    address,
    abi: HTML_ABI,
    functionName: "html",
  });
  const body = new TextEncoder().encode(html);
  if (!body.byteLength || body.byteLength > MAX_HTML_BYTES) {
    throw new Error("WNS HTML must be non-empty and no larger than 1 MiB.");
  }
  return { status: 200, body, contentType: "text/html; charset=utf-8" };
}

export async function resolveWei(name: string): Promise<ResolveResponse> {
  if (!isWeiName(name)) return { ok: false, error: `Not a .wei name: ${name}` };
  const ensName = name.toLowerCase().replace(/\.$/, "");
  const rpcUrl = await getStoredRpcUrl(1);
  if (!rpcUrl)
    return {
      ok: false,
      code: "no-mainnet-rpc",
      error:
        "No Ethereum mainnet RPC configured. Open WalletChan → Settings → Chain RPCs to add one.",
    };
  const client = getDirectClient(rpcUrl);
  try {
    const node = namehash(ensName);
    const raw = await client.readContract({
      address: WEI_CONTRACT,
      abi: RESOLVER_ABI,
      functionName: "contenthash",
      args: [node],
    });
    if (raw && raw !== "0x") {
      const kind = getCodec(raw);
      if (kind !== "ipfs" && kind !== "ipns") {
        return {
          ok: false,
          error: `Unsupported WNS contenthash codec "${kind}".`,
        };
      }
      return {
        ok: true,
        kind,
        value: decode(raw),
        ensName,
        trustedDirectly: true,
      };
    }
    const address = await client.readContract({
      address: WEI_CONTRACT,
      abi: RESOLVER_ABI,
      functionName: "addr",
      args: [node],
    });
    if (!address || /^0x0+$/i.test(address)) {
      return {
        ok: false,
        error: `${ensName} has no website contenthash or resolved address.`,
      };
    }
    const contractAddress = address.toLowerCase() as `0x${string}`;
    const settings = await getEnsBrowsingSettings();
    if (settings.useLocalGateway && settings.pinOnchainHtml) {
      return fetchPinAndCacheErc4804(
        client,
        contractAddress,
        ensName,
        true,
        fetchWeiHtml,
      );
    }
    await fetchWeiHtml(client, contractAddress);
    return {
      ok: true,
      kind: "web3",
      value: contractAddress,
      ensName,
      trustedDirectly: true,
      contractAddress,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to resolve ${ensName}: ${describeResolverError(error)}`,
    };
  }
}
