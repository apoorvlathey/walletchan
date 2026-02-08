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
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function useAddressResolver(
  input: string,
  debounceMs = 500
): AddressResolverResult {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const latestInput = useRef(input);

  useEffect(() => {
    latestInput.current = input;

    // Reset on empty input
    if (!input) {
      setResolvedAddress(null);
      setResolvedName(null);
      setAvatar(null);
      setIsResolving(false);
      setIsLoadingExtras(false);
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

      const timer = setTimeout(async () => {
        if (latestInput.current !== input) return;
        setIsLoadingExtras(true);

        try {
          const name = await resolveAddressToName(input);
          if (latestInput.current !== input) return;
          setResolvedName(name);

          if (name) {
            const av = await getNameAvatar(name);
            if (latestInput.current !== input) return;
            setAvatar(av);
          }
        } catch {
          // Silently fail reverse resolution
        } finally {
          if (latestInput.current === input) {
            setIsLoadingExtras(false);
          }
        }
      }, debounceMs);

      return () => clearTimeout(timer);
    }

    // If resolvable name, forward-resolve with debounce
    if (isName) {
      setResolvedAddress(null);
      setResolvedName(null);
      setAvatar(null);
      setIsResolving(false);
      setIsLoadingExtras(false);

      const timer = setTimeout(async () => {
        if (latestInput.current !== input) return;
        setIsResolving(true);

        try {
          const address = await resolveNameToAddress(input);
          if (latestInput.current !== input) return;

          setResolvedAddress(address);
          setIsResolving(false);

          if (address) {
            setIsLoadingExtras(true);
            const av = await getNameAvatar(input);
            if (latestInput.current !== input) return;
            setAvatar(av);
          }
        } catch {
          if (latestInput.current === input) {
            setResolvedAddress(null);
            setIsResolving(false);
          }
        } finally {
          if (latestInput.current === input) {
            setIsLoadingExtras(false);
          }
        }
      }, debounceMs);

      return () => clearTimeout(timer);
    }

    // Neither valid address nor resolvable name
    setResolvedAddress(null);
    setResolvedName(null);
    setAvatar(null);
    setIsResolving(false);
    setIsLoadingExtras(false);
  }, [input, debounceMs]);

  const isValid = resolvedAddress !== null && ADDRESS_REGEX.test(resolvedAddress);

  return { resolvedAddress, resolvedName, avatar, isResolving, isLoadingExtras, isValid };
}
