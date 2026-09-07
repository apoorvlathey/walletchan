import { useState, useEffect, useRef } from "react";
import {
  isResolvableName,
  resolveNameToAddress,
  resolveAddressToName,
  getNameAvatar,
} from "@/lib/ensUtils";

interface AddressResolverResult {
  resolvedAddress: string | null;
  resolvedName: string | null;
  avatar: string | null;
  /** True while the primary address resolution is in progress (forward-resolve for names) */
  isResolving: boolean;
  /** True while secondary lookups (reverse name, avatar) are in progress */
  isLoadingExtras: boolean;
  isValid: boolean;
  /** Non-null when resolution failed due to an RPC / network error */
  error: string | null;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function useAddressResolver(
  input: string,
  debounceMs = 500,
  chainId = 1,
): AddressResolverResult {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = `${chainId}:${input}`;
  const latestInput = useRef(requestKey);
  latestInput.current = requestKey;
  const [resolvedKey, setResolvedKey] = useState(requestKey);

  useEffect(() => {
    let cancelled = false;
    latestInput.current = requestKey;
    setResolvedKey(requestKey);

    // Reset on empty input
    if (!input) {
      setResolvedAddress(null);
      setResolvedName(null);
      setAvatar(null);
      setIsResolving(false);
      setIsLoadingExtras(false);
      setError(null);
      return;
    }

    const isAddress = ADDRESS_REGEX.test(input);
    const isName = isResolvableName(input);

    // If raw address, set immediately then reverse-resolve in background
    if (isAddress) {
      setResolvedAddress(input);
      setResolvedName(null);
      setAvatar(null);
      setIsResolving(false);
      setIsLoadingExtras(false);
      setError(null);

      const timer = setTimeout(async () => {
        if (cancelled || latestInput.current !== requestKey) return;
        setIsLoadingExtras(true);

        try {
          const name = await resolveAddressToName(input, chainId);
          if (cancelled || latestInput.current !== requestKey) return;
          setResolvedName(name);

          if (name) {
            const av = await getNameAvatar(name);
            if (cancelled || latestInput.current !== requestKey) return;
            setAvatar(av);
          }
        } catch {
          // Silently fail reverse resolution
        } finally {
          if (!cancelled && latestInput.current === requestKey) {
            setIsLoadingExtras(false);
          }
        }
      }, debounceMs);

      return () => { cancelled = true; clearTimeout(timer); };
    }

    // If resolvable name, forward-resolve with debounce
    if (isName) {
      setResolvedAddress(null);
      setResolvedName(null);
      setAvatar(null);
      setIsResolving(false);
      setIsLoadingExtras(false);
      setError(null);

      const timer = setTimeout(async () => {
        if (cancelled || latestInput.current !== requestKey) return;
        setIsResolving(true);

        try {
          const address = await resolveNameToAddress(input, chainId);
          if (cancelled || latestInput.current !== requestKey) return;

          setResolvedAddress(address);
          setIsResolving(false);
          setError(null);

          if (address) {
            setIsLoadingExtras(true);
            const av = await getNameAvatar(input);
            if (cancelled || latestInput.current !== requestKey) return;
            setAvatar(av);
          }
        } catch (err) {
          if (!cancelled && latestInput.current === requestKey) {
            setResolvedAddress(null);
            setIsResolving(false);
            const msg = err instanceof Error ? err.message : String(err);
            if (/429|too many/i.test(msg)) {
              setError("RPC rate limited (429). Try switching your RPC URL in Settings.");
            } else {
              setError("Failed to resolve name. Check your RPC URL in Settings.");
            }
          }
        } finally {
          if (!cancelled && latestInput.current === requestKey) {
            setIsLoadingExtras(false);
          }
        }
      }, debounceMs);

      return () => { cancelled = true; clearTimeout(timer); };
    }

    // Neither valid address nor resolvable name
    setResolvedAddress(null);
    setResolvedName(null);
    setAvatar(null);
    setIsResolving(false);
    setIsLoadingExtras(false);
    setError(null);
  }, [input, debounceMs, chainId, requestKey]);

  const isValid = resolvedAddress !== null && ADDRESS_REGEX.test(resolvedAddress);

  if (resolvedKey !== requestKey) return {
    resolvedAddress: null, resolvedName: null, avatar: null,
    isResolving: true, isLoadingExtras: false, isValid: false, error: null,
  };
  return { resolvedAddress, resolvedName, avatar, isResolving, isLoadingExtras, isValid, error };
}
