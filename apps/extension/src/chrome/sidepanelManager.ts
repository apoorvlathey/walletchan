/**
 * Side panel management utilities
 * Handles browser detection, sidepanel API support, and mode toggling
 */

/**
 * Checks if we're running in Arc browser
 * Arc has chrome.sidePanel but it doesn't work properly
 * Note: In service worker context, we can't check CSS variables, so we use storage
 */
export function isArcBrowser(): boolean {
  try {
    // Arc browser identifies itself in the user agent
    return navigator.userAgent.includes("Arc/");
  } catch {
    return false;
  }
}

/**
 * Checks if the browser supports the sidePanel API
 * Note: Some browsers (like Arc) may have chrome.sidePanel defined but non-functional
 */
export function isSidePanelSupported(): boolean {
  try {
    // Arc browser has broken sidepanel support - skip entirely
    if (isArcBrowser()) {
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
 * Tests if sidepanel actually works by attempting to set panel behavior
 * Returns true only if the API call succeeds
 */
export async function testSidePanelWorks(): Promise<boolean> {
  try {
    if (!isSidePanelSupported()) {
      return false;
    }

    // Try to set panel behavior - if this fails, the API is broken
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    return true;
  } catch (error) {
    console.warn("SidePanel API exists but is non-functional:", error);
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
  // Check if we've previously determined sidepanel doesn't work (e.g., Arc browser)
  const { sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get(["sidePanelMode", "sidePanelVerified"]);

  // If we haven't verified yet, or verification found it doesn't work, return false
  if (sidePanelVerified === false) {
    return false;
  }

  // Default to true (sidepanel mode) if supported and not explicitly set to false
  return sidePanelMode !== false;
}

/**
 * Sets the sidepanel mode setting
 * Returns false if setting sidepanel behavior failed (browser doesn't support it properly)
 */
export async function setSidePanelMode(enabled: boolean): Promise<boolean> {
  // Check if Arc browser first - sidepanel is broken there
  const { isArcBrowser: storedIsArc } = await chrome.storage.sync.get(["isArcBrowser"]);
  if (storedIsArc && enabled) {
    // Can't enable sidepanel in Arc
    return false;
  }

  if (!isSidePanelSupported()) {
    // No sidepanel support at all
    if (enabled) {
      return false;
    }
    await chrome.storage.sync.set({ sidePanelMode: false });
    return true; // Successfully set to popup mode (the only option)
  }

  try {
    if (enabled) {
      // Trying to enable sidepanel - test first
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      // If we get here, it worked
      await chrome.storage.sync.set({ sidePanelMode: true, sidePanelVerified: true });
      return true;
    } else {
      // Disabling sidepanel (going to popup mode)
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      await chrome.storage.sync.set({ sidePanelMode: false });
      return true;
    }
  } catch (error) {
    console.warn("Failed to set sidepanel behavior:", error);
    // Mark sidepanel as not working for this browser
    await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
    return false;
  }
}

/**
 * Initialize sidepanel behavior on startup
 * IMPORTANT: We default to popup mode and only enable sidepanel when explicitly requested by UI
 * This ensures Arc browser (where sidepanel is broken) works properly with popup
 */
export async function initSidePanel(): Promise<void> {
  try {
    // Check if we've stored that this is Arc browser (detected by UI via CSS variable)
    const { isArcBrowser: storedIsArc, sidePanelMode, sidePanelVerified } = await chrome.storage.sync.get([
      "isArcBrowser",
      "sidePanelMode",
      "sidePanelVerified"
    ]);

    if (storedIsArc) {
      // Arc browser - sidepanel doesn't work, ensure popup mode
      console.log("Arc browser detected, ensuring popup mode");
      // Make absolutely sure sidepanel won't intercept clicks
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors
        }
      }
      return;
    }

    // If sidepanel has been verified as not working, ensure popup mode
    if (sidePanelVerified === false) {
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors
        }
      }
      return;
    }

    // Only enable sidepanel if it's explicitly been enabled by user AND verified to work
    // This is the key change: we don't auto-enable sidepanel on first run
    if (isSidePanelSupported() && sidePanelMode === true && sidePanelVerified === true) {
      try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      } catch (error) {
        // If setting sidepanel fails, disable it
        console.warn("Failed to enable sidepanel:", error);
        await chrome.storage.sync.set({ sidePanelVerified: false, sidePanelMode: false });
      }
    } else {
      // Default: ensure popup mode (sidepanel won't intercept clicks)
      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch {
          // Ignore errors - some browsers don't have this API
        }
      }
    }
  } catch (error) {
    // If anything fails during sidepanel initialization, log and continue
    // The extension will fall back to popup mode (which is the safe default)
    console.error("Error during sidepanel initialization:", error);
  }
}
