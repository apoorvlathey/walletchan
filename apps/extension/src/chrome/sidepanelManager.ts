/**
 * Side panel management utilities
 * Handles browser detection, sidepanel API support, and mode toggling
 *
 * KEY DESIGN: We never use openPanelOnActionClick (it suppresses the popup completely).
 * Instead, we control behavior via chrome.action.setPopup():
 * - Popup mode: setPopup({ popup: 'popup-init.html' }) → native popup opens
 * - Sidepanel mode: setPopup({ popup: '' }) → action.onClicked fires → sidePanel.open() with fallback
 */

/**
 * Checks if we're running in Arc browser (older versions with UA signal)
 * Note: In service worker context, we can't check CSS variables, so we use storage
 */
export function isArcBrowser(): boolean {
  try {
    return navigator.userAgent.includes("Arc/");
  } catch {
    return false;
  }
}

/**
 * Checks if this is a non-Chrome Chromium browser (Arc, Brave, Opera, etc.)
 * These browsers expose chrome.sidePanel but it may not work properly.
 * Arc's sidePanel API is a "perfect phantom" — sidePanel.open() resolves successfully
 * and getContexts reports a SIDE_PANEL context, but nothing is rendered.
 * Genuine Chrome always includes "Google Chrome" in userAgentData.brands.
 */
export function isNonChromeBrowser(): boolean {
  try {
    const uaData = (navigator as any).userAgentData;
    if (!uaData?.brands) return false;
    const hasGoogleChrome = uaData.brands.some(
      (b: { brand: string }) => b.brand === "Google Chrome"
    );
    return !hasGoogleChrome;
  } catch {
    return false;
  }
}

/**
 * Checks if the browser supports the sidePanel API
 * Only returns true on genuine Chrome — other Chromium browsers (Arc, Brave, etc.)
 * may expose chrome.sidePanel but it silently fails to render.
 */
export function isSidePanelSupported(): boolean {
  try {
    if (isArcBrowser() || isNonChromeBrowser()) {
      return false;
    }
    return typeof chrome !== "undefined" &&
      typeof chrome.sidePanel !== "undefined" &&
      chrome.sidePanel !== null &&
      typeof chrome.sidePanel.setPanelBehavior === "function";
  } catch {
    return false;
  }
}

/**
 * Tests if sidepanel actually works by checking sidePanel.open availability
 * Returns true only if the API appears functional
 */
export async function testSidePanelWorks(): Promise<boolean> {
  try {
    if (!isSidePanelSupported()) {
      return false;
    }
    return typeof chrome.sidePanel.open === "function";
  } catch {
    return false;
  }
}

/**
 * Gets the current sidepanel mode setting
 */
export async function getSidePanelMode(): Promise<boolean> {
  if (!isSidePanelSupported()) {
    return false;
  }
  const { sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get(["sidePanelMode", "sidePanelVerified"]);

  if (sidePanelVerified === false) {
    return false;
  }

  // Default to true (sidepanel mode) if supported and not explicitly set to false
  return sidePanelMode !== false;
}

/**
 * Sets the sidepanel mode setting
 * Uses chrome.action.setPopup to control behavior:
 * - Sidepanel mode: popup = '' (action.onClicked fires, which calls sidePanel.open)
 * - Popup mode: popup = 'popup-init.html' (native popup opens)
 * Returns false if sidepanel mode cannot be enabled
 */
export async function setSidePanelMode(enabled: boolean): Promise<boolean> {
  // Block enabling on non-Chrome browsers (Arc, Brave, etc.) - sidepanel silently fails
  if (enabled && isNonChromeBrowser()) {
    return false;
  }

  // Check if Arc browser first - sidepanel is broken there
  const { isArcBrowser: storedIsArc } = await chrome.storage.sync.get(["isArcBrowser"]);
  if (storedIsArc && enabled) {
    return false;
  }

  if (!isSidePanelSupported()) {
    if (enabled) {
      return false;
    }
    await chrome.storage.sync.set({ sidePanelMode: false });
    await chrome.action.setPopup({ popup: "popup-init.html" });
    return true;
  }

  try {
    if (enabled) {
      // Clear popup so action.onClicked fires → sidePanel.open() in background.ts
      await chrome.action.setPopup({ popup: "" });
      await chrome.storage.sync.set({ sidePanelMode: true, sidePanelVerified: true });
      return true;
    } else {
      // Restore native popup
      await chrome.action.setPopup({ popup: "popup-init.html" });
      await chrome.storage.sync.set({ sidePanelMode: false });
      return true;
    }
  } catch (error) {
    console.warn("Failed to set sidepanel mode:", error);
    await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
    await chrome.action.setPopup({ popup: "popup-init.html" });
    return false;
  }
}

/**
 * Initialize sidepanel behavior on startup
 * IMPORTANT: Never use openPanelOnActionClick — it's an all-or-nothing setting that
 * suppresses the popup completely. Instead, we control behavior via chrome.action.setPopup():
 * - Popup mode: setPopup({ popup: 'popup-init.html' }) → native popup opens
 * - Sidepanel mode: setPopup({ popup: '' }) → action.onClicked fires → sidePanel.open() with fallback
 */
export async function initSidePanel(): Promise<void> {
  try {
    // Always disable openPanelOnActionClick — we handle sidepanel opening manually
    if (chrome.sidePanel?.setPanelBehavior) {
      try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      } catch {
        // Ignore errors - some browsers don't have this API
      }
    }

    // Detect non-Chrome Chromium browsers (Arc, Brave, etc.) where sidePanel silently fails
    if (isNonChromeBrowser()) {
      // Persist the flag and force-disable sidepanel if it was previously enabled
      await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
      await chrome.action.setPopup({ popup: "popup-init.html" });
      return;
    }

    // Check stored flags
    const { isArcBrowser: storedIsArc, sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get([
      "isArcBrowser",
      "sidePanelMode",
      "sidePanelVerified"
    ]);

    if (storedIsArc) {
      await chrome.action.setPopup({ popup: "popup-init.html" });
      return;
    }

    if (sidePanelVerified === false) {
      await chrome.action.setPopup({ popup: "popup-init.html" });
      return;
    }

    // Only enable sidepanel if explicitly enabled by user AND verified to work
    if (isSidePanelSupported() && sidePanelMode === true && sidePanelVerified === true) {
      // Clear popup so action.onClicked fires → sidePanel.open() in background.ts
      await chrome.action.setPopup({ popup: "" });
    } else {
      // Default: ensure popup mode
      await chrome.action.setPopup({ popup: "popup-init.html" });
    }
  } catch (error) {
    console.error("Error during sidepanel initialization:", error);
    try {
      await chrome.action.setPopup({ popup: "popup-init.html" });
    } catch {
      // Last resort - ignore
    }
  }
}
