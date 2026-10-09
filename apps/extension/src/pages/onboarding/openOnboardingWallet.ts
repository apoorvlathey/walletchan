export interface OnboardingWalletTarget {
  sidePanelSupported: boolean;
  windowId?: number;
}

/** Resolve before the click so sidePanel.open retains the user's activation. */
export async function getOnboardingWalletTarget(): Promise<OnboardingWalletTarget> {
  const [support, tabs] = await Promise.all([
    chrome.runtime.sendMessage({ type: "isSidePanelSupported" }),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);
  return { sidePanelSupported: support?.supported === true, windowId: tabs[0]?.windowId };
}

/** Reuse the wallet's sidepanel mode and existing popup-window route. */
export async function openOnboardingWallet(target: OnboardingWalletTarget): Promise<void> {
  if (target.sidePanelSupported && target.windowId !== undefined && chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({ windowId: target.windowId });
      void chrome.runtime.sendMessage({ type: "setSidePanelMode", enabled: true }).catch(() => undefined);
      return;
    } catch {
      // Browsers can expose the API but reject opening; retain the popup fallback.
    }
  }
  const result = await chrome.runtime.sendMessage({ type: "openPopupWindow" });
  if (!result?.success) throw new Error("Could not open wallet. Try again.");
}
