import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "@ethersproject/contracts";
import { isAddress } from "@ethersproject/address";
import { namehash } from "@ethersproject/hash";
import { ens_normalize } from "@adraffy/ens-normalize";
import { DEFAULT_NETWORKS } from "@/constants/networks";
import { WNS_CONTRACT_ADDRESS, WNS_ABI } from "@/constants/wns";

// Cache entry with TTL
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// In-memory cache with 5-minute TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const forwardCache = new Map<string, CacheEntry<string | null>>();
const reverseCache = new Map<string, CacheEntry<string | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, timestamp: Date.now() });
}

// Lazy-loaded provider
let mainnetProvider: StaticJsonRpcProvider | null = null;
function getMainnetProvider(): StaticJsonRpcProvider {
  if (!mainnetProvider) {
    mainnetProvider = new StaticJsonRpcProvider(DEFAULT_NETWORKS.Ethereum.rpcUrl);
  }
  return mainnetProvider;
}

// Lazy-loaded WNS contract
let wnsContract: Contract | null = null;
function getWnsContract(): Contract {
  if (!wnsContract) {
    wnsContract = new Contract(WNS_CONTRACT_ADDRESS, WNS_ABI, getMainnetProvider());
  }
  return wnsContract;
}

/**
 * Compute the WNS token ID for a given name
 * Uses ENS-compatible namehash algorithm
 */
function computeWnsTokenId(name: string): string {
  const normalized = ens_normalize(name);
  return namehash(normalized);
}

/**
 * Resolve a .wei name to an address using the WNS contract
 */
async function resolveWnsName(name: string): Promise<string | null> {
  try {
    const tokenId = computeWnsTokenId(name);
    const contract = getWnsContract();
    const address = await contract.resolve(tokenId);

    // Check if address is valid (not zero address)
    if (address && address !== "0x0000000000000000000000000000000000000000") {
      return address;
    }
    return null;
  } catch (error) {
    console.error("WNS resolution failed:", error);
    return null;
  }
}

/**
 * Resolve a .eth name to an address using ENS
 */
async function resolveEnsName(name: string): Promise<string | null> {
  try {
    const provider = getMainnetProvider();
    const address = await provider.resolveName(name);
    return address;
  } catch (error) {
    console.error("ENS resolution failed:", error);
    return null;
  }
}

/**
 * Resolve an input to an Ethereum address
 * Supports: raw addresses, .eth ENS names, .wei WNS names
 *
 * @param input - Address, ENS name, or WNS name
 * @returns Resolved address or null if resolution failed
 */
export async function resolveAddress(input: string): Promise<string | null> {
  const trimmed = input.trim();

  // Check if it's already a valid address
  if (isAddress(trimmed)) {
    return trimmed;
  }

  // Check cache first
  const cacheKey = trimmed.toLowerCase();
  const cached = getCached(forwardCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let result: string | null = null;

  // Detect name type and resolve
  if (trimmed.endsWith(".wei")) {
    result = await resolveWnsName(trimmed);
  } else if (trimmed.endsWith(".eth")) {
    result = await resolveEnsName(trimmed);
  } else {
    // Try ENS as fallback for other TLDs
    result = await resolveEnsName(trimmed);
  }

  // Cache the result
  setCache(forwardCache, cacheKey, result);

  return result;
}

/**
 * Reverse resolve an address to a name
 * Tries WNS first, then falls back to ENS
 *
 * @param address - Ethereum address to look up
 * @returns Name (.wei or .eth) or null if not found
 */
export async function reverseResolveAddress(address: string): Promise<string | null> {
  if (!isAddress(address)) {
    return null;
  }

  // Check cache first
  const cacheKey = address.toLowerCase();
  const cached = getCached(reverseCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let result: string | null = null;

  // Try WNS reverse resolution first
  try {
    const contract = getWnsContract();
    const wnsName = await contract.reverseResolve(address);
    if (wnsName && typeof wnsName === "string" && wnsName.length > 0) {
      result = wnsName;
    }
  } catch (error) {
    // WNS reverse resolution not available or failed
    console.debug("WNS reverse resolution failed:", error);
  }

  // Fall back to ENS if WNS didn't find a name
  if (!result) {
    try {
      const provider = getMainnetProvider();
      const ensName = await provider.lookupAddress(address);
      if (ensName) {
        result = ensName;
      }
    } catch (error) {
      console.debug("ENS reverse resolution failed:", error);
    }
  }

  // Cache the result
  setCache(reverseCache, cacheKey, result);

  return result;
}
