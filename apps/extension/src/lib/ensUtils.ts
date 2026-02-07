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

// ============================================================================
// Constants
// ============================================================================

const BASENAME_L2_RESOLVER_ADDRESS =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;

// ============================================================================
// Public Clients (singletons)
// ============================================================================

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

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
    const address = await mainnetClient.getEnsAddress({
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
    const addressReverseNode = convertReverseNodeToBytes(address, base.id);
    const basename = await baseClient.readContract({
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
    const name = await mainnetClient.getEnsName({
      address: address as Hex,
    });
    return name;
  } catch {
    return null;
  }
};

export const resolveAddressToName = async (
  address: string
): Promise<string | null> => {
  try {
    const [ensName, basename] = await Promise.all([
      getEnsName(address),
      getBasename(address as Address),
    ]);
    return ensName || basename || null;
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
    const avatar = await mainnetClient.getEnsAvatar({
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
    const avatar = await baseClient.readContract({
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
