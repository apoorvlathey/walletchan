import { useCallback, useEffect, useState } from "react";
import type { SeedGroup } from "@/chrome/types";

/** Public metadata only; phrase reveal stays in the master-password route. */
export function useSeedBackupState(seedGroupId?: string) {
  const [groups, setGroups] = useState<SeedGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    let revision = 0;
    const refresh = async () => {
      const requestedRevision = ++revision;
      try {
        const result = await chrome.runtime.sendMessage({ type: "getSeedGroups" });
        if (!Array.isArray(result)) throw new Error("Could not check wallet backup");
        if (!disposed && revision === requestedRevision) { setGroups(result); setError(""); }
      } catch (cause) {
        if (!disposed && revision === requestedRevision) setError(cause instanceof Error ? cause.message : "Could not check wallet backup");
      } finally {
        if (!disposed && revision === requestedRevision) setIsLoading(false);
      }
    };
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.seedGroups) void refresh();
    };
    const onMessage = (message: { type?: string }) => {
      if (message.type === "accountsUpdated") void refresh();
    };
    void refresh();
    chrome.storage.onChanged.addListener(onStorage);
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [seedGroupId]);

  const confirm = useCallback(async (): Promise<boolean> => {
    if (!seedGroupId) return false;
    setIsSaving(true); setError("");
    try {
      const result = await chrome.runtime.sendMessage({ type: "confirmSeedBackup", seedGroupId, confirmed: true });
      if (!result?.success) throw new Error(result?.error || "Could not confirm backup");
      setGroups((current) => current.map((group) => group.id === seedGroupId ? { ...group, backupPending: undefined } : group));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm backup");
      return false;
    } finally { setIsSaving(false); }
  }, [seedGroupId]);
  return { groups, pending: groups.some((group) => group.id === seedGroupId && group.backupPending === true), isLoading, error, isSaving, confirm };
}
