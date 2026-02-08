import {
  createPublicClient,
  http,
  Hex,
  Address,
  encodePacked,
  keccak256,
  namehash,
} from "viem";
import { mainnet, base } from "viem/chains";
import { normalize } from "viem/ens";
import { L2ResolverAbi } from "./L2ResolverAbi";
import { DEFAULT_NETWORKS } from "@/constants/networks";
import type { NetworksInfo } from "@/types";
import wei from "@/utils/wei";

// ============================================================================
// Constants
// ============================================================================

const BASENAME_L2_RESOLVER_ADDRESS =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;

// ============================================================================
// Public Clients (use user-configured RPCs from storage)
// ============================================================================

async function getUserRpcUrl(chainId: number): Promise<string> {
  try {
    const { networksInfo } = (await chrome.storage.sync.get("networksInfo")) as {
      networksInfo: NetworksInfo | undefined;
    };
    if (networksInfo) {
      for (const name of Object.keys(networksInfo)) {
        if (networksInfo[name].chainId === chainId) {
          return networksInfo[name].rpcUrl;
        }
      }
    }
  } catch {
    // Fall through to defaults (e.g. if chrome.storage is unavailable)
  }
  // Fallback to defaults
  for (const name of Object.keys(DEFAULT_NETWORKS)) {
    if (DEFAULT_NETWORKS[name].chainId === chainId) {
      return DEFAULT_NETWORKS[name].rpcUrl;
    }
  }
  // Hardcoded last resort
  return chainId === base.id
    ? "https://mainnet.base.org"
    : "https://eth.llamarpc.com";
}

async function getMainnetClient() {
  const rpcUrl = await getUserRpcUrl(mainnet.id);
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
}

async function getBaseClient() {
  const rpcUrl = await getUserRpcUrl(base.id);
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

// ============================================================================
// Helpers
// ============================================================================

export const isResolvableName = (value: string): boolean => {
  if (!value || value.length === 0) return false;
  return value.includes(".") && !value.toLowerCase().startsWith("0x");
};

const isBasename = (name: string): boolean => {
  return name.toLowerCase().endsWith(".base.eth");
};

const convertChainIdToCoinType = (chainId: number): string => {
  if (chainId === mainnet.id) return "addr";
  const cointype = (0x80000000 | chainId) >>> 0;
  return cointype.toString(16).toLocaleUpperCase();
};

const convertReverseNodeToBytes = (
  address: Address,
  chainId: number
): Hex => {
  const addressFormatted = address.toLocaleLowerCase() as Address;
  const addressNode = keccak256(addressFormatted.substring(2) as Address);
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

export const resolveNameToAddress = async (
  name: string
): Promise<Address | null> => {
  try {
    // Handle .wei names via WNS
    if (wei.isWei(name)) {
      const address = await wei.resolve(name);
      return address as Address | null;
    }

    // ENS handles .eth, .base.eth, and other names
    const client = await getMainnetClient();
    const address = await client.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch (error) {
    console.error("Error resolving name to address:", error);
    return null;
  }
};

// ============================================================================
// Reverse Resolution (Address → Name)
// ============================================================================

const getBasename = async (address: Address): Promise<string | null> => {
  try {
    const client = await getBaseClient();
    const addressReverseNode = convertReverseNodeToBytes(address, base.id);
    const basename = await client.readContract({
      abi: L2ResolverAbi,
      address: BASENAME_L2_RESOLVER_ADDRESS,
      functionName: "name",
      args: [addressReverseNode],
    });

    if (basename && basename.length > 0) {
      return basename as string;
    }
    return null;
  } catch {
    return null;
  }
};

const getEnsName = async (address: string): Promise<string | null> => {
  try {
    const client = await getMainnetClient();
    const name = await client.getEnsName({
      address: address as Hex,
    });
    return name;
  } catch {
    return null;
  }
};

const getWeiName = async (address: string): Promise<string | null> => {
  try {
    return await wei.reverseResolve(address);
  } catch {
    return null;
  }
};

export const resolveAddressToName = async (
  address: string
): Promise<string | null> => {
  try {
    const [ensName, basename, weiName] = await Promise.all([
      getEnsName(address),
      getBasename(address as Address),
      getWeiName(address),
    ]);
    // Priority: ENS > Basename > WNS
    return ensName || basename || weiName || null;
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
    const client = await getMainnetClient();
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
    const client = await getBaseClient();
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

export const getNameAvatar = async (
  name: string
): Promise<string | null> => {
  if (isBasename(name)) {
    const basenameAvatar = await getBasenameAvatar(name);
    if (basenameAvatar) return basenameAvatar;
    return await getEnsAvatar(name);
  }
  return await getEnsAvatar(name);
};

// ============================================================================
// Combined Identity Resolution (ENS > Basename > WNS)
// ============================================================================

/**
 * Resolves name + avatar for an address with explicit priority:
 * ENS > Basename > WNS (Wei Name Service)
 * - Resolves all name services in parallel for speed
 * - If ENS name exists, uses ENS name + ENS avatar
 * - Falls back to Basename name + Basename avatar
 * - Falls back to WNS name (no avatar support for .wei names)
 */
export const resolveEnsIdentity = async (
  address: string
): Promise<{ name: string | null; avatar: string | null }> => {
  try {
    const [ensName, basename, weiName] = await Promise.all([
      getEnsName(address),
      getBasename(address as Address),
      getWeiName(address),
    ]);

    // ENS takes priority
    if (ensName) {
      const avatar = await getEnsAvatar(ensName);
      return { name: ensName, avatar };
    }

    // Fall back to Basename
    if (basename) {
      const avatar = await getBasenameAvatar(basename);
      return { name: basename, avatar };
    }

    // Fall back to WNS (no avatar support)
    if (weiName) {
      return { name: weiName, avatar: null };
    }

    return { name: null, avatar: null };
  } catch (error) {
    console.error("Error resolving identity for", address, error);
    return { name: null, avatar: null };
  }
};
