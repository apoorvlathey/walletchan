import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SendRecipientReference } from "@/chrome/history/sendRecipientReferences";
import {
  canProceedWithRecipientCheck,
  findAddressPoisoningMatch,
  parseSendRecipientReferences,
} from "../model/addressPoisoning";

type ReferenceState = {
  status: "loading" | "ready" | "error";
  references: SendRecipientReference[];
  revision: number;
};

/** Mounted only by Send. No signing, mutation, or remote address lookup. */
export function useSendRecipientSafety(options: {
  recipient: string;
  resolvedAddress: string | null;
  fromAddress: string;
  chainId: number;
}) {
  const [state, setState] = useState<ReferenceState>({ status: "loading", references: [], revision: 0 });
  const requestVersion = useRef(0);
  const mounted = useRef(false);
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setState((previous) => ({ ...previous, status: "loading", revision: version }));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        chrome.runtime.sendMessage({ type: "getSendRecipientReferences" }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Recipient check timed out")), 10_000);
        }),
      ]);
      const references = parseSendRecipientReferences(result);
      if (mounted.current && version === requestVersion.current) {
        setState({ status: "ready", references, revision: version });
      }
    } catch {
      if (mounted.current && version === requestVersion.current) {
        setState({ status: "error", references: [], revision: version });
      }
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    const listener = (message: { type?: string }) => {
      if (message?.type === "txHistoryUpdated" || message?.type === "addressContactsUpdated") void reload();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      mounted.current = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [reload]);

  const match = useMemo(() => findAddressPoisoningMatch(options.resolvedAddress, state.references),
    [options.resolvedAddress, state.references]);
  const context = JSON.stringify([options.fromAddress, options.chainId, options.recipient,
    options.resolvedAddress, state.revision, match?.address]);
  const [review, setReview] = useState({ context, acknowledged: false });
  // Reset in render so changing A -> B -> A cannot resurrect an old acknowledgement.
  if (review.context !== context) setReview({ context, acknowledged: false });
  const acknowledged = review.context === context && review.acknowledged;

  return {
    status: state.status,
    match,
    acknowledged,
    setAcknowledged: (value: boolean) => setReview({ context, acknowledged: value }),
    canProceed: canProceedWithRecipientCheck(state.status, match, acknowledged),
    retry: () => { void reload(); },
  };
}

export type SendRecipientSafety = ReturnType<typeof useSendRecipientSafety>;
