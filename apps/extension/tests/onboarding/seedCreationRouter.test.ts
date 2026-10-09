import assert from "node:assert/strict";
import test from "node:test";
import { createChromeStorageHarness } from "../helpers/chromeStorageHarness";

test("seed creation router leaves authentication usable across session states", async (t) => {
  const harness = createChromeStorageHarness({ sync: { autoLockTimeout: 60_000 } });
  const session = await import("../../src/chrome/sessionCache");
  const transition = await import("../../src/chrome/authTransition");
  const { createBackgroundOnboardingMessageRouter } = await import("../../src/chrome/background/onboardingRouter");
  const { createBackgroundAuthMessageRouter } = await import("../../src/chrome/background/authRouter");
  const { getAccounts, getSeedGroups } = await import("../../src/chrome/accountStorage");
  const onboarding = createBackgroundOnboardingMessageRouter({
    resetWalletConnectForWalletReset: async () => {},
    invalidateAvatarImageCacheForWalletReset: () => {},
    sendRuntimeMessage: async () => {},
  });
  const auth = createBackgroundAuthMessageRouter();
  const password = "router-test-only-master-password-71";
  const owner = "router-test-owner";
  type Router = typeof onboarding;

  async function request(router: Router, message: Record<string, unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${message.type} did not respond`)), 10_000);
        assert.deepEqual(router(message, resolve), { handled: true, keepChannelOpen: true });
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const create = () => request(onboarding, { type: "createOnboardingSeedAccount", initializationId: owner });
  async function initialize() {
    session.clearInMemoryAuthCache();
    transition.clearManualLockRestorationBlock();
    for (const store of Object.values(harness.stores)) {
      for (const key of Object.keys(store)) delete store[key];
    }
    harness.stores.sync.autoLockTimeout = 60_000;
    session.updateCachedAutoLockTimeout(60_000);
    harness.stores.local.onboardingInitialization = { version: 1, id: owner, startedAt: Date.now() };
    assert.equal((await request(onboarding, {
      type: "initializeOnboardingCredential", initializationId: owner,
      credential: "pk-only-mode", password,
    })).success, true);
  }
  try {
    for (const state of ["cold worker", "expired", "locked", "agent"] as const) {
      await t.test(state, async () => {
        await initialize();

        const originalNow = Date.now;
        try {
          if (state === "cold worker") session.clearInMemoryAuthCache();
          else if (state === "expired") {
            const expiredAt = Date.now() + 60_001;
            Date.now = () => expiredAt;
          } else if (state === "locked") {
            assert.equal((await request(auth, { type: "lockWallet" })).success, true);
          } else session.setCachedPasswordType("agent");

          // Cold restoration lacks the plaintext master password needed for a
          // first V1 mnemonic; every state must return a failure, never hang.
          assert.equal((await create()).success, false);
          assert.deepEqual(await getAccounts(), []);
          assert.deepEqual(await getSeedGroups(), []);
          assert.equal(harness.stores.local.mnemonicVault, undefined);
          assert.equal(harness.stores.local.pkVault, undefined);
          assert.equal((await request(auth, { type: "lockWallet" })).success, true);
        } finally {
          Date.now = originalNow;
        }

        assert.equal((await request(auth, { type: "unlockWallet", password })).success, true);
        const created = await create();
        assert.equal(created.success, true);
        assert.deepEqual(Object.keys(created).sort(), ["account", "success"]);
        assert.equal((await getAccounts()).length, 1);
        assert.equal((await getSeedGroups())[0].backupPending, true);
        assert.equal((await request(auth, { type: "lockWallet" })).success, true);
        assert.equal(session.getPasswordType(), null);
      });
    }
    await t.test("manual lock during authorization prevents seed persistence", async () => {
      await initialize();
      let releaseRead!: () => void;
      let observeRead!: () => void;
      const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
      const readObserved = new Promise<void>((resolve) => { observeRead = resolve; });
      const originalGet = chrome.storage.local.get;
      let blocked = false;
      chrome.storage.local.get = (async (keys: string | string[] | null) => {
        const result = await originalGet(keys);
        if (keys === "mnemonicVault" && !blocked) {
          blocked = true;
          observeRead();
          await readGate;
        }
        return result;
      }) as typeof chrome.storage.local.get;
      const pendingCreation = create();
      try {
        await readObserved;
        assert.equal((await request(auth, { type: "lockWallet" })).success, true);
      } finally {
        releaseRead();
        chrome.storage.local.get = originalGet;
      }
      assert.equal((await pendingCreation).success, false);
      assert.deepEqual(await getAccounts(), []);
      assert.deepEqual(await getSeedGroups(), []);
      assert.equal(harness.stores.local.mnemonicVault, undefined);
      assert.equal(harness.stores.local.pkVault, undefined);
      assert.equal(session.getPasswordType(), null);
    });
  } finally {
    session.clearInMemoryAuthCache();
    transition.clearManualLockRestorationBlock();
    harness.restore();
  }
});
