import {
  createPublicClient,
  isAddress,
  Hex,
  Address,
  encodePacked,
  keccak256,
  namehash,
  stringToHex,
} from "viem";
import { mainnet, base } from "viem/chains";
import { normalize } from "viem/ens";
import { L2ResolverAbi } from "./L2ResolverAbi";
import wei, { GWEI_CONTRACT } from "@/utils/wei";
import {
  isMega,
  megaNamesAbi,
  MEGA_NAMES_CONTRACT,
  MEGAETH_CHAIN_ID,
} from "@/utils/mega";
import { getStoredRpcUrl } from "@/lib/chains";
import { secureHttpTransport } from "@/chrome/network/rpcClient";

// ============================================================================
// Constants
// ============================================================================

export const BASENAME_L2_RESOLVER_ADDRESS =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;

const GWEI_NAME_NFT_AVATAR_ABI = [
  {
    type: "function",
    name: "computeId",
    stateMutability: "pure",
    inputs: [{ name: "fullName", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ============================================================================
// Public Clients (use user-configured RPCs from storage)
// ============================================================================

// Resolves via chainRegistry → user override > registry default. Throws if the
// chain isn't registered; only call with chain IDs known to be in CHAIN_REGISTRY.
async function getUserRpcUrl(chainId: number): Promise<string> {
  const rpcUrl = await getStoredRpcUrl(chainId).catch(() => undefined);
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return rpcUrl;
}

export async function getMainnetNameServiceClient() {
  const rpcUrl = await getUserRpcUrl(mainnet.id);
  return createPublicClient({
    chain: mainnet,
    transport: secureHttpTransport(rpcUrl, { timeout: 8_000, retryCount: 0 }),
  });
}

export async function getBaseNameServiceClient() {
  const rpcUrl = await getUserRpcUrl(base.id);
  return createPublicClient({
    chain: base,
    transport: secureHttpTransport(rpcUrl, { timeout: 8_000, retryCount: 0 }),
  });
}

export async function getMegaNameServiceClient() {
  const rpcUrl = await getUserRpcUrl(MEGAETH_CHAIN_ID);
  return createPublicClient({
    chain: {
      id: MEGAETH_CHAIN_ID,
      name: "MegaETH",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: secureHttpTransport(rpcUrl, { timeout: 8_000, retryCount: 0 }),
  });
}

// ============================================================================
// Helpers
// ============================================================================

export const isResolvableName = (value: string): boolean => {
  if (!value || value.length === 0) return false;
  return value.includes(".") && !value.toLowerCase().startsWith("0x");
};

/**
 * Unicode characters that must NEVER appear in a name we render to the user:
 *  - C0/C1 control chars (break rendering)
 *  - Zero-width / invisible marks (hide content inside a name)
 *  - BiDi overrides + isolates (reverse displayed text — U+202E "Trojan Source")
 *  - Line/paragraph separators (split the rendered name across lines)
 *  - Object Replacement Character (placeholder for missing glyphs)
 *
 * Any resolved name (ENS / Basename / Wei / Gwei / Mega) containing one of these is
 * treated as hostile and discarded. We do NOT try to clean / repair the name —
 * showing a partial name is worse than showing the raw address.
 */
// Written with \u escape sequences only — the literal characters would
// themselves render the source file dangerously (U+202E reverses surrounding
// text; U+2028 terminates lines from a JS lexer's perspective). Do not edit
// this regex by pasting the raw characters.
const HAZARDOUS_NAME_CHARS_RE =
// eslint-disable-next-line no-control-regex
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2028\u2029\u2066-\u2069\uFEFF\uFFFC]/;

const PRINTABLE_ASCII_RE = /^[\x21-\x7e]+$/;

/**
 * Sanitize an address-to-name resolution result for display.
 *
 * Returns:
 *  - `null` if the name is empty, exceeds DNS length (253), or contains
 *    hazardous Unicode. Callers fall back to showing the raw address.
 *  - the ASCII / IDN-encoded ("xn--…") form if the name contained non-ASCII
 *    characters. This forces visually-confusable Unicode (Cyrillic 'а' that
 *    looks like Latin 'a', etc.) to render as its unambiguous punycode label
 *    so users can tell at a glance that the name is not pure-ASCII.
 *  - the name unchanged when it's already pure printable ASCII.
 *
 * Defense against reverse-resolution spoofing. An attacker who owns
 * `apple‐.eth` (with a combining mark) or a Cyrillic-Latin homoglyph name
 * can register it cheaply on ENS/Basenames/WNS/GNS/Mega and dangle it on a vanity
 * address; if a victim ever transacts with that address, the reverse lookup
 * decorates every future confirmation surface with a trusted-looking name.
 * Hard-rejecting hazardous chars and forcing punycode for non-ASCII names
 * closes both vectors without engineering full Unicode-confusable detection.
 */
export function sanitizeResolvedName(name: string | null | undefined): string | null {
  if (!name || typeof name !== "string") return null;
  if (name.length === 0 || name.length > 253) return null;
  if (HAZARDOUS_NAME_CHARS_RE.test(name)) return null;
  // Pure printable-ASCII fast path — the common case for ENS/Basenames.
  if (PRINTABLE_ASCII_RE.test(name)) return name;
  // Any non-ASCII name is forced through the URL parser's IDN encoder; the
  // resulting hostname is the canonical punycode form. If encoding fails or
  // the result is itself non-ASCII (shouldn't happen with a conforming URL
  // parser), refuse to display.
  try {
    const ascii = new URL(`http://${name}/`).hostname;
    if (ascii && PRINTABLE_ASCII_RE.test(ascii)) return ascii;
    return null;
  } catch {
    return null;
  }
}

const isBasename = (name: string): boolean => {
  return name.toLowerCase().endsWith(".base.eth");
};

const convertChainIdToCoinType = (chainId: number): string => {
  if (chainId === mainnet.id) return "addr";
  const cointype = (0x80000000 | chainId) >>> 0;
  return cointype.toString(16).toLocaleUpperCase();
};

export const convertReverseNodeToBytes = (
  address: Address,
  chainId: number
): Hex => {
  const addressFormatted = address.toLocaleLowerCase() as Address;
  const addressNode = keccak256(stringToHex(addressFormatted.substring(2)));
  const chainCoinType = convertChainIdToCoinType(chainId);
  const baseReverseNode = namehash(
    `${chainCoinType.toLocaleUpperCase()}.reverse`
  );
  const addressReverseNode = keccak256(
    encodePacked(["bytes32", "bytes32"], [baseReverseNode, addressNode])
  );
  return addressReverseNode;
};

// ============================================================================
// Forward Resolution (Name → Address)
// ============================================================================

/** Zero selects ENS's explicit default EVM identity, never Ethereum's record. */
export function ensCoinType(chainId: number): bigint {
  if (!Number.isSafeInteger(chainId) || chainId < 0 || chainId > 0x7fffffff) {
    throw new Error("Chain ID is outside the ENSIP-11 range");
  }
  return chainId === 1 ? 60n : BigInt(chainId) + 0x80000000n;
}

const resolveMegaName = async (
  name: string
): Promise<Address | null> => {
  try {
    const client = await getMegaNameServiceClient();
    const tokenId = BigInt(namehash(name.toLowerCase()));
    const ZERO = "0x0000000000000000000000000000000000000000";

    // Primary: ownerOf (ERC-721 owner is the resolved address)
    try {
      const owner = await client.readContract({
        abi: megaNamesAbi,
        address: MEGA_NAMES_CONTRACT,
        functionName: "ownerOf",
        args: [tokenId],
      });
      if (owner && owner !== ZERO) return owner as Address;
    } catch {
      // Token may not exist — fall through to addr
    }

    // Fallback: explicit addr mapping (for subdomains or custom setAddr)
    const address = await client.readContract({
      abi: megaNamesAbi,
      address: MEGA_NAMES_CONTRACT,
      functionName: "addr",
      args: [tokenId],
    });
    if (!address || address === ZERO) return null;
    return address as Address;
  } catch {
    return null;
  }
};

const getMegaName = async (
  address: string
): Promise<string | null> => {
  try {
    const client = await getMegaNameServiceClient();
    const name = await client.readContract({
      abi: megaNamesAbi,
      address: MEGA_NAMES_CONTRACT,
      functionName: "getName",
      args: [address as Address],
    });
    if (!name || name.length === 0) return null;
    return sanitizeResolvedName(name as string);
  } catch {
    return null;
  }
};

export const resolveNameToAddress = async (
  name: string,
  chainId = 1,
): Promise<Address | null> => {
  // Handle .wei/.gwei names via WNS/GNS. Missing mainnet RPC still surfaces
  // from getUserRpcUrl; service-level misses/timeouts resolve as null.
  if (wei.isSupportedName(name)) {
    const rpcUrl = await getUserRpcUrl(mainnet.id);
    wei.config({ rpc: rpcUrl });
    const address = await wei.resolve(name);
    return address as Address | null;
  }

  // Handle .mega names via MegaNames (handles its own errors, returns null for not-found)
  if (isMega(name)) {
    return await resolveMegaName(name);
  }

  // ENS handles .eth, .base.eth, and other names
  // normalize() throws for invalid name format — return null for that (not an RPC issue)
  let normalizedName: string;
  try {
    normalizedName = normalize(name);
  } catch {
    return null;
  }

  // Let RPC errors (429, timeouts, etc.) propagate so callers can show actionable feedback
  const client = await getMainnetNameServiceClient();
  const address = await client.getEnsAddress({ name: normalizedName, coinType: ensCoinType(chainId) });
  return address && isAddress(address, { strict: false }) ? address : null;
};

// ============================================================================
// Reverse Resolution (Address → Name)
// ============================================================================

const getBasename = async (address: Address): Promise<string | null> => {
  try {
    const client = await getBaseNameServiceClient();
    const addressReverseNode = convertReverseNodeToBytes(address, base.id);
    const basename = await client.readContract({
      abi: L2ResolverAbi,
      address: BASENAME_L2_RESOLVER_ADDRESS,
      functionName: "name",
      args: [addressReverseNode],
    });

    if (basename && basename.length > 0) {
      return sanitizeResolvedName(basename as string);
    }
    return null;
  } catch {
    return null;
  }
};

// Official ENS mainnet L2 deployments: https://docs.ens.domains/registry/reverse/
// Used only when the Universal Resolver cannot return a name. Never probe
// arbitrary custom chains at this address; check the deployed coin type too.
const ENS_L2_REVERSE_CHAINS = new Set([10, 8453, 42161, 59144, 534352]);
const ENS_L2_REVERSE_REGISTRAR = "0x0000000000D8e504002cC26E3Ec46D81971C1664";
const ENS_L2_REVERSE_ABI = [
  { type: "function", name: "coinType", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nameForAddr", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "string" }] },
] as const;

/** Direct L2 fallback, always forward-verified on the requested network. */
export async function getL2EnsName(address: Address, chainId: number): Promise<string | null> {
  if (!ENS_L2_REVERSE_CHAINS.has(chainId)) return null;
  try {
    const rpcUrl = await getUserRpcUrl(chainId);
    const client = createPublicClient({
      transport: secureHttpTransport(rpcUrl, { timeout: 8_000, retryCount: 0 }),
    });
    const coinType = await client.readContract({
      address: ENS_L2_REVERSE_REGISTRAR, abi: ENS_L2_REVERSE_ABI, functionName: "coinType",
    });
    if (coinType !== ensCoinType(chainId)) return null;
    const name = sanitizeResolvedName(await client.readContract({
      address: ENS_L2_REVERSE_REGISTRAR, abi: ENS_L2_REVERSE_ABI,
      functionName: "nameForAddr", args: [address],
    }));
    return name && await isNameForAddress(name, address, chainId) ? name : null;
  } catch {
    return null;
  }
}

const getEnsName = async (address: string, chainId: number): Promise<string | null> => {
  try {
    const client = await getMainnetNameServiceClient();
    const name = await client.getEnsName({
      address: address as Hex,
      coinType: ensCoinType(chainId),
    });
    if (name) return sanitizeResolvedName(name);
  } catch {
    // L1 gateway/proof failures must not hide a verified live L2 record.
  }
  return getL2EnsName(address as Address, chainId);
};

const getWeiName = async (
  address: string,
  suffix: ".wei" | ".gwei" = ".wei"
): Promise<string | null> => {
  try {
    // Configure name SDK to use user's Ethereum RPC instead of hardcoded defaults
    const rpcUrl = await getUserRpcUrl(mainnet.id);
    wei.config({ rpc: rpcUrl });
    return sanitizeResolvedName(await wei.reverseResolve(address, suffix));
  } catch {
    return null;
  }
};

const getGweiName = async (address: string): Promise<string | null> => {
  return getWeiName(address, ".gwei");
};

export const resolveAddressToName = async (
  address: string,
  chainId = 1,
): Promise<string | null> => {
  try {
    const [ensName, basename, weiName, gweiName, megaName] = await Promise.all([
      getEnsName(address, chainId),
      getBasename(address as Address),
      getWeiName(address),
      getGweiName(address),
      getMegaName(address),
    ]);
    // Priority: ENS > Basename > WNS > GNS > Mega
    for (const name of [ensName, basename, weiName, gweiName, megaName]) {
      if (name && await isNameForAddress(name, address, chainId)) return name;
    }
    return null;
  } catch (error) {
    console.error("Error resolving address to name:", error);
    return null;
  }
};

// ============================================================================
// Avatar Resolution
// ============================================================================

const getEnsAvatar = async (ensName: string): Promise<string | null> => {
  try {
    const client = await getMainnetNameServiceClient();
    const avatar = await client.getEnsAvatar({
      name: normalize(ensName),
    });
    return avatar;
  } catch {
    return null;
  }
};

const getBasenameAvatar = async (
  basename: string
): Promise<string | null> => {
  try {
    const client = await getBaseNameServiceClient();
    const avatar = await client.readContract({
      abi: L2ResolverAbi,
      address: BASENAME_L2_RESOLVER_ADDRESS,
      functionName: "text",
      args: [namehash(basename), "avatar"],
    });

    if (avatar && avatar.length > 0) {
      return avatar as string;
    }
    return null;
  } catch {
    return null;
  }
};

const getMegaAvatar = async (
  megaName: string
): Promise<string | null> => {
  try {
    const client = await getMegaNameServiceClient();
    const tokenId = BigInt(namehash(megaName.toLowerCase()));
    const avatar = await client.readContract({
      abi: megaNamesAbi,
      address: MEGA_NAMES_CONTRACT,
      functionName: "text",
      args: [tokenId, "avatar"],
    });
    if (avatar && avatar.length > 0) return avatar as string;
    return null;
  } catch {
    return null;
  }
};

const getGweiAvatar = async (
  gweiName: string
): Promise<string | null> => {
  try {
    const client = await getMainnetNameServiceClient();
    const tokenId = await client.readContract({
      abi: GWEI_NAME_NFT_AVATAR_ABI,
      address: GWEI_CONTRACT as Address,
      functionName: "computeId",
      args: [gweiName],
    });
    if (tokenId === 0n) return null;

    const avatar = await client.readContract({
      abi: GWEI_NAME_NFT_AVATAR_ABI,
      address: GWEI_CONTRACT as Address,
      functionName: "text",
      args: [tokenId, "avatar"],
    });
    return avatar.length > 0 ? avatar : null;
  } catch {
    return null;
  }
};

export const getNameAvatar = async (
  name: string
): Promise<string | null> => {
  if (isMega(name)) {
    return await getMegaAvatar(name);
  }
  if (wei.isGwei(name)) {
    return await getGweiAvatar(name);
  }
  if (wei.isSupportedName(name)) {
    return null;
  }
  if (isBasename(name)) {
    const basenameAvatar = await getBasenameAvatar(name);
    if (basenameAvatar) return basenameAvatar;
    return await getEnsAvatar(name);
  }
  return await getEnsAvatar(name);
};

// ============================================================================
// Combined Identity Resolution (ENS > Basename > WNS > GNS > Mega)
// ============================================================================

/** Verify every fallback service and name hint before using it as an identity. */
export async function isNameForAddress(name: string, address: string, chainId: number): Promise<boolean> {
  try {
    const resolved = await resolveNameToAddress(name, chainId);
    return Boolean(resolved && resolved.toLowerCase() === address.toLowerCase());
  } catch {
    return false;
  }
}

/** Resolve a verified name, then its avatar, using the shared service priority. */
export const resolveEnsIdentity = async (
  address: string,
  chainId = 1,
): Promise<{ name: string | null; avatar: string | null }> => {
  const name = await resolveAddressToName(address, chainId);
  return { name, avatar: name ? await getNameAvatar(name) : null };
};
