import assert from "node:assert/strict";
import test from "node:test";
import { getOnboardingWalletTarget, openOnboardingWallet } from "../../src/pages/onboarding/openOnboardingWallet";

test("onboarding opens the wallet with activation preserved and popup fallback", async (t) => {
  const originalChrome = globalThis.chrome;
  const messages: Array<{ type: string; enabled?: boolean }> = [];
  let supported = true;
  let popupSuccess = true;
  let panelOpen: (options: { windowId: number }) => Promise<void> = async () => undefined;
  globalThis.chrome = {
    tabs: { query: async () => [{ windowId: 42 }] },
    sidePanel: { open: (options: { windowId: number }) => panelOpen(options) },
    runtime: { sendMessage: async (message: { type: string; enabled?: boolean }) => {
      messages.push(message);
      return message.type === "isSidePanelSupported" ? { supported } : { success: popupSuccess };
    } },
  } as unknown as typeof chrome;
  try {
    await t.test("capability and window are prepared before the click", async () => {
      assert.deepEqual(await getOnboardingWalletTarget(), { sidePanelSupported: true, windowId: 42 });
      assert.equal(messages[0].type, "isSidePanelSupported");
      messages.length = 0;
    });
    await t.test("panel opening starts synchronously before yielding", async () => {
      let openedWindow: number | undefined;
      let resolveOpen!: () => void;
      panelOpen = (options) => {
        openedWindow = options.windowId;
        return new Promise<void>((resolve) => { resolveOpen = resolve; });
      };
      const opening = openOnboardingWallet({ sidePanelSupported: true, windowId: 42 });
      assert.equal(openedWindow, 42);
      assert.deepEqual(messages, []);
      resolveOpen();
      await opening;
      assert.deepEqual(messages, [{ type: "setSidePanelMode", enabled: true }]);
      messages.length = 0;
    });
    await t.test("unsupported browsers reuse the popup route", async () => {
      supported = false;
      panelOpen = async () => { assert.fail("unsupported browsers must not open a panel"); };
      await openOnboardingWallet(await getOnboardingWalletTarget());
      assert.deepEqual(messages.map((message) => message.type), ["isSidePanelSupported", "openPopupWindow"]);
      messages.length = 0;
    });
    await t.test("rejected panel opening falls back and failed popup remains retryable", async () => {
      panelOpen = async () => { throw new Error("Gesture rejected"); };
      await openOnboardingWallet({ sidePanelSupported: true, windowId: 42 });
      assert.deepEqual(messages, [{ type: "openPopupWindow" }]);
      popupSuccess = false;
      await assert.rejects(openOnboardingWallet({ sidePanelSupported: false }), /Could not open wallet/);
    });
  } finally { globalThis.chrome = originalChrome; }
});
