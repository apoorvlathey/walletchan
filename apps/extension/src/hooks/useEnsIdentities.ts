import { useAddressContacts } from "@/hooks/useAddressContacts";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getEnsIdentityCache,
  ensIdentityKey,
  isCacheValid,
  resolveAndCacheIdentities,
  resolveAndCacheIdentity,
  type EnsIdentityCacheEntry,
} from "@/lib/ensIdentityCache";

interface EnsIdentity {
  name: string | null;
  avatar: string | null;
}

interface UseEnsIdentitiesReturn {
  identities: Map<string, EnsIdentity>;
  isLoading: boolean;
  refreshAddress: (address: string) => Promise<void>;
}

function useNetworkEnsIdentities(addresses: string[], chainId = 1): UseEnsIdentitiesReturn {
  const [identities, setIdentities] = useState<Map<string, EnsIdentity>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const resolvedRef = useRef<Set<string>>(new Set());

  const [resolvedChain, setResolvedChain] = useState(chainId);
  const chainRef = useRef(chainId);
  chainRef.current = chainId;

  // Stable serialized key for addresses array
  const addressesKey = addresses
    .map((a) => a.toLowerCase())
    .sort()
    .join(",");

  // Listen for storage changes so refreshes from other UI surfaces
  // (e.g. AccountSettings' "Refresh ENS Data") propagate immediately.
  useEffect(() => {
    const lowerAddresses = addresses.map((a) => a.toLowerCase());
    if (lowerAddresses.length === 0) return;

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local" || !changes.ensIdentityCache) return;
      const newCache = changes.ensIdentityCache.newValue as
        | Record<string, EnsIdentityCacheEntry>
        | undefined;
      if (!newCache) return;

      if (chainRef.current !== chainId) return;
      setIdentities((prev) => {
        const updated = new Map(prev);
        let mutated = false;
        for (const lower of lowerAddresses) {
          const entry = newCache[ensIdentityKey(lower, chainId)];
          if (!entry || !isCacheValid(entry)) continue;
          const existing = prev.get(lower);
          if (
            !existing ||
            existing.name !== entry.name ||
            existing.avatar !== entry.avatar
          ) {
            updated.set(lower, { name: entry.name, avatar: entry.avatar });
            mutated = true;
          }
        }
        return mutated ? updated : prev;
      });
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [addressesKey, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    resolvedRef.current.clear();
    setIsLoading(false);
    setIdentities(new Map());
    setResolvedChain(chainId);

    async function loadAndResolve() {
      if (addresses.length === 0) return;

      const cache = await getEnsIdentityCache();
      if (cancelled) return;
      const newIdentities = new Map<string, EnsIdentity>();
      const staleAddresses: string[] = [];

      for (const addr of addresses) {
        const lower = addr.toLowerCase();
        const cached = cache[ensIdentityKey(lower, chainId)];

        // Expiry schedules a refresh; it does not erase the last display identity.
        // Partial contact hints still require verification before display.
        if (cached && !cached.needsAvatar) {
          newIdentities.set(lower, { name: cached.name, avatar: cached.avatar });
        }
        if (!cached || !isCacheValid(cached)) {
          // Only resolve if we haven't already started resolving in this session
          if (!resolvedRef.current.has(lower)) {
            staleAddresses.push(addr);
          }
        }
      }

      if (!cancelled) {
        setIdentities(newIdentities);
      }

      if (staleAddresses.length > 0) {
        if (!cancelled) setIsLoading(true);

        // Mark as being resolved
        for (const addr of staleAddresses) {
          resolvedRef.current.add(addr.toLowerCase());
        }

        const results = await resolveAndCacheIdentities(staleAddresses, chainId).catch(() => new Map());

        if (!cancelled) {
          setIdentities((prev) => {
            const updated = new Map(prev);
            staleAddresses.forEach((addr) => {
              const lower = addr.toLowerCase();
              const result = results.get(lower);
              if (result) updated.set(lower, result);
            });
            return updated;
          });
          setIsLoading(false);
        }
      }
    }

    loadAndResolve();

    return () => {
      cancelled = true;
    };
  }, [addressesKey, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAddress = useCallback(async (address: string) => {
    const lower = address.toLowerCase();
    setIsLoading(true);
    try {
      const result = await resolveAndCacheIdentity(address, chainId);
      if (chainRef.current !== chainId) return;
      setIdentities((prev) => {
        const updated = new Map(prev);
        updated.set(lower, result);
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  return { identities: resolvedChain === chainId ? identities : new Map(), isLoading, refreshAddress };
}


/** Known wallets and saved contacts retain their mainnet profile on every network.
 * This is display-only; forward payment resolution still uses the selected chain.
 */
export function useEnsIdentities(addresses: string[], chainId = 1): UseEnsIdentitiesReturn {
  const { contacts, isLoading: contactsLoading } = useAddressContacts();
  const [accountAddresses, setAccountAddresses] = useState<string[] | null>(null);
  const needsMembership = chainId !== 1;
  useEffect(() => {
    if (!needsMembership) return;
    let cancelled = false;
    let generation = 0;
    const load = async () => {
      const current = ++generation;
      try {
        const accounts = await chrome.runtime.sendMessage({ type: "getAccounts" });
        if (!cancelled && current === generation) setAccountAddresses(
          Array.isArray(accounts) ? accounts.map((account) => account.address.toLowerCase()) : [],
        );
      } catch {
        if (!cancelled && current === generation) setAccountAddresses([]);
      }
    };
    const listener = (message: { type?: string }) => {
      if (message.type === "accountsUpdated") void load();
    };
    void load();
    chrome.runtime.onMessage.addListener(listener);
    return () => { cancelled = true; chrome.runtime.onMessage.removeListener(listener); };
  }, [needsMembership]);
  const known = useMemo(() => new Set([
    ...(accountAddresses ?? []), ...contacts.map((contact) => contact.address.toLowerCase()),
  ]), [accountAddresses, contacts]);
  const ready = !needsMembership || (accountAddresses !== null && !contactsLoading);
  const addressesKey = addresses.map((address) => address.toLowerCase()).join(",");
  const [profiles, external] = useMemo(() => {
    const requested = addressesKey ? addressesKey.split(",") : [];
    return [
      requested.filter((address) => chainId === 1 || (ready && known.has(address))),
      requested.filter((address) => chainId !== 1 && ready && !known.has(address)),
    ];
  }, [addressesKey, chainId, ready, known]);
  const profile = useNetworkEnsIdentities(profiles, 1);
  const network = useNetworkEnsIdentities(external, chainId);
  const identities = useMemo(() => {
    const identities = new Map<string, EnsIdentity>();
    for (const address of profiles) {
      const key = address.toLowerCase();
      const identity = profile.identities.get(key);
      if (identity) identities.set(key, identity);
    }
    for (const address of external) {
      const key = address.toLowerCase();
      const identity = network.identities.get(key);
      if (identity) identities.set(key, identity);
    }
    return identities;
  }, [profiles, external, profile.identities, network.identities]);
  return {
    identities,
    isLoading: !ready || profile.isLoading || network.isLoading,
    refreshAddress: (address) => (chainId === 1 || known.has(address.toLowerCase())
      ? profile.refreshAddress(address) : network.refreshAddress(address)),
  };
}
