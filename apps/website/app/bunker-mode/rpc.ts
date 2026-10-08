import {
  createPublicClient,
  fallback,
  getAddress,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import {
  BUNKER_CHAINS,
  classifyNonce,
  type ChainResult,
  type ScanChain,
} from "./model";
const ETH_RPCS = [
  BUNKER_CHAINS.find((c) => c.id === 1)!.rpcUrls[0],
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
];
const client = createPublicClient({
  chain: mainnet,
  transport: fallback(
    ETH_RPCS.map((url) => http(url, { timeout: 4000, retryCount: 0 })),
    { retryCount: 0 },
  ),
});
const nameAbi = parseAbi([
  "function computeId(string) view returns (uint256)",
  "function resolve(uint256) view returns (address)",
  "function text(uint256,string) view returns (string)",
  "function reverseResolve(address) view returns (string)",
]);
const names = {
  wei: "0x0000000000696760E15f265e828DB644A0c242EB",
  gwei: "0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6",
} as const;
export type Identity = { address: Address; name?: string; avatar?: string };
function imageUrl(value: string | null | undefined): string | undefined {
  if (!value) return;
  if (value.startsWith("ipfs://"))
    return `https://ipfs.io/ipfs/${value.slice(7).replace(/^ipfs\//, "")}`;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.href;
  } catch {
    /* use generated avatar */
  }
}
export function isCheckableInput(raw: string): boolean {
  const input = raw.trim();
  if (!input || input.length > 255) return false;
  if (isAddress(input)) return true;
  if (input.startsWith("0x") || !input.includes(".")) return false;
  try {
    const labels = normalize(input).split(".");
    return labels.length > 1 && labels.every((label) => label.length > 0);
  } catch {
    return false;
  }
}
export async function resolveIdentity(raw: string): Promise<Identity> {
  const input = raw.trim();
  if (isAddress(input)) return { address: getAddress(input) };
  if (input.startsWith("0x"))
    throw new Error("Enter a valid Ethereum address.");
  const suffix = input.toLowerCase().endsWith(".gwei")
    ? "gwei"
    : input.toLowerCase().endsWith(".wei")
      ? "wei"
      : null;
  if (suffix) {
    const name = input.toLowerCase();
    const address = names[suffix];
    const id = await client.readContract({
      address,
      abi: nameAbi,
      functionName: "computeId",
      args: [name],
    });
    const owner =
      id === 0n
        ? zeroAddress
        : await client.readContract({
            address,
            abi: nameAbi,
            functionName: "resolve",
            args: [id],
          });
    if (owner === zeroAddress)
      throw new Error("That name has no address record.");
    return { address: getAddress(owner), name };
  }
  if (!input.includes("."))
    throw new Error("Enter an address or an ENS, .wei or .gwei name.");
  let name: string;
  try {
    name = normalize(input);
  } catch {
    throw new Error("That name is not valid.");
  }
  const address = await client.getEnsAddress({ name });
  if (!address || address === zeroAddress)
    throw new Error("That name has no Ethereum address record.");
  return { address: getAddress(address), name };
}
async function lookupReverseNames(
  address: Address,
): Promise<(string | null)[]> {
  return Promise.all([
    client
      .readContract({
        address: names.gwei,
        abi: nameAbi,
        functionName: "reverseResolve",
        args: [address],
      })
      .then((name) => (name.endsWith(".gwei") ? name : null))
      .catch(() => null),
    client
      .readContract({
        address: names.wei,
        abi: nameAbi,
        functionName: "reverseResolve",
        args: [address],
      })
      .then((name) => (name.endsWith(".wei") ? name : null))
      .catch(() => null),
    client.getEnsName({ address }).catch(() => null),
  ]);
}
export async function selectVerifiedReverseName(
  candidates: (string | null)[],
  address: Address,
  resolve: typeof resolveIdentity = resolveIdentity,
): Promise<string | undefined> {
  for (const name of candidates) {
    if (
      !name ||
      name.length > 255 ||
      /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name)
    )
      continue;
    try {
      const forward = await resolve(name);
      if (forward.address.toLowerCase() === address.toLowerCase())
        return forward.name;
    } catch {
      // Unavailable or invalid preferred names must not hide a valid fallback.
    }
  }
}
async function avatarForName(name: string): Promise<string | undefined> {
  try {
    const suffix = name.endsWith(".gwei")
      ? "gwei"
      : name.endsWith(".wei")
        ? "wei"
        : null;
    if (suffix) {
      const id = await client.readContract({
        address: names[suffix],
        abi: nameAbi,
        functionName: "computeId",
        args: [name],
      });
      if (id === 0n) return;
      return imageUrl(
        await client.readContract({
          address: names[suffix],
          abi: nameAbi,
          functionName: "text",
          args: [id, "avatar"],
        }),
      );
    }
    return imageUrl(await client.getEnsAvatar({ name }));
  } catch {
    // A service without avatar records, or an unavailable record, permits fallback.
    return;
  }
}
export async function resolveProfile(identity: Identity): Promise<Identity> {
  let profile = identity;
  let candidates: (string | null)[] | undefined;
  try {
    if (!profile.name) {
      candidates = await lookupReverseNames(identity.address);
      profile = {
        ...profile,
        name: await selectVerifiedReverseName(candidates, identity.address),
      };
    }
    const primaryAvatar = profile.name
      ? await avatarForName(profile.name)
      : undefined;
    if (primaryAvatar) return { ...profile, avatar: primaryAvatar };
    candidates ??= await lookupReverseNames(identity.address);
    for (const candidate of candidates) {
      if (!candidate || candidate === profile.name) continue;
      const verified = await selectVerifiedReverseName(
        [candidate],
        identity.address,
      );
      if (!verified) continue;
      const avatar = await avatarForName(verified);
      // Borrow only the avatar; keep the selected or entered display name.
      if (avatar) return { ...profile, avatar };
    }
    return profile;
  } catch {
    return profile;
  }
}
type RpcReply = { id: number; result?: unknown; error?: unknown };
export async function scanChain(
  chain: ScanChain,
  address: Address,
  signal: AbortSignal,
): Promise<ChainResult> {
  const calls = [
    { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_getTransactionCount",
      params: [address, "latest"],
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "eth_getCode",
      params: [address, "latest"],
    },
  ];
  const urls = chain.id === 1 ? ETH_RPCS : chain.rpcUrls;
  for (const url of urls) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const timeout = AbortSignal.timeout(6000);
    const requestSignal = AbortSignal.any([signal, timeout]);
    const post = async (body: unknown) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: requestSignal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("RPC unavailable");
      return response.json();
    };
    try {
      let replies: RpcReply[];
      try {
        replies = await post(calls);
        if (
          !Array.isArray(replies) ||
          replies.length !== 3 ||
          replies.some((r) => r.error)
        )
          throw new Error("Batch unsupported");
      } catch {
        if (requestSignal.aborted) throw new Error("RPC timeout");
        replies = await Promise.all(calls.map(post));
      }
      const read = (id: number) => {
        const reply = replies.find((r) => r.id === id);
        if (!reply || reply.error) throw new Error("Invalid RPC result");
        return reply.result;
      };
      const chainId = read(1);
      if (
        typeof chainId !== "string" ||
        !/^0x[0-9a-f]+$/i.test(chainId) ||
        BigInt(chainId) !== BigInt(chain.id)
      )
        throw new Error("Wrong network");
      return classifyNonce(chain, read(2), read(3));
    } catch {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    }
  }
  return { chain, status: "error" };
}
