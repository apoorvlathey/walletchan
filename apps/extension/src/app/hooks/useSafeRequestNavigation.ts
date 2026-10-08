import { useCallback, useState } from "react";
import type { SafeAccount } from "@/chrome/types";
import { useThemedToast } from "@/hooks/useThemedToast";
import { getSafeRequestAccount } from "../initialSafeRequests";

/** Renderer navigation only; Safe signing authority stays in the background. */
export function useSafeRequestNavigation({
  setIsWalletUnlocked, setView,
}: {
  setIsWalletUnlocked: (unlocked: boolean) => void;
  setView: (view: "safeApprovals" | "unlock") => void;
}) {
  const toast = useThemedToast();
  const [safeRequestAccount, setSafeRequestAccount] = useState<SafeAccount | null>(null);
  const [selectedSafeProposalId, setSelectedSafeProposalId] = useState<string | null>(null);
  const [safeProposalEntryPoint, setSafeProposalEntryPoint] = useState<"requests" | "activity">("requests");
  const openSafeApprovals = useCallback(async (
    proposalId: string | null,
    entryPoint: "requests" | "activity" = "requests",
  ) => {
    try {
      if (proposalId) {
        const account = await getSafeRequestAccount(proposalId);
        if (!account) throw new Error("The Safe account for this request is unavailable");
        setSafeRequestAccount(account);
      } else setSafeRequestAccount(null);
      const unlocked = !!await chrome.runtime.sendMessage({ type: "isWalletUnlocked" });
      setIsWalletUnlocked(unlocked);
      setSelectedSafeProposalId(proposalId);
      setSafeProposalEntryPoint(entryPoint);
      setView(unlocked ? "safeApprovals" : "unlock");
    } catch (error) {
      toast({ title: "Could not open Safe request", description: error instanceof Error ? error.message : "Retry opening the request", status: "error" });
    }
  }, [setIsWalletUnlocked, setView, toast]);
  return {
    safeRequestAccount, selectedSafeProposalId, setSelectedSafeProposalId,
    safeProposalEntryPoint, setSafeProposalEntryPoint, openSafeApprovals,
  };
}
