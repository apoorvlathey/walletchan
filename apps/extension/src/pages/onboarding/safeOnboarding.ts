import type { SafeChainSnapshot } from "@/chrome/safe/types";

export interface SafeOnboardingSelection {
  address: `0x${string}`;
  snapshots: SafeChainSnapshot[];
  verificationIds: string[];
  failures?: Array<{ chainId: number; error: string }>;
}

export async function probeOnboardingSafe(address: string): Promise<SafeOnboardingSelection> {
  const result = await chrome.runtime.sendMessage({ type: "probeSafeAddress", address });
  if (result?.success === false) throw new Error(result.error || "Could not check this Safe");
  if (!result?.address || !result.snapshots?.length || !result.verificationIds?.length) {
    throw new Error("No verified Safe found on the checked networks");
  }
  return { address: result.address, snapshots: result.snapshots, verificationIds: result.verificationIds, failures: result.failures };
}

// Refresh worker-owned receipts after credential setup, without silently importing
// a different Safe configuration than the user reviewed before the password step.
export async function refreshOnboardingSafe(selection: SafeOnboardingSelection): Promise<SafeOnboardingSelection> {
  const fresh = await probeOnboardingSafe(selection.address);
  if (fresh.address.toLowerCase() !== selection.address.toLowerCase()) throw new Error("Safe address changed. Go back and check it again");
  const snapshots = selection.snapshots.map((reviewed) => {
    const current = fresh.snapshots.find((snapshot) => snapshot.chainId === reviewed.chainId);
    if (!current || current.configEpoch !== reviewed.configEpoch) {
      throw new Error("Safe configuration changed. Go back and check it again");
    }
    return current;
  });
  return { ...fresh, snapshots };
}
