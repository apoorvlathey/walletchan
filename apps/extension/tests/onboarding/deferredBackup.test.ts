import assert from "node:assert/strict";
import test from "node:test";
import { createChromeStorageHarness } from "../helpers/chromeStorageHarness";

test("fresh seed creation retains encrypted recovery and a durable backup reminder", async (t) => {
  const harness = createChromeStorageHarness({ sync: { autoLockTimeout: 60_000 } });
  const session = await import("../../src/chrome/sessionCache");
  const { createOnboardingSeedAccount } = await import("../../src/chrome/onboarding/seedAccount");
  const { initializeOnboardingCredential } = await import("../../src/chrome/onboarding/credential");
  const { getMnemonic } = await import("../../src/chrome/mnemonicStorage");
  const { confirmSeedBackup } = await import("../../src/chrome/mnemonic/backup");
  const { getSeedGroups, getAccounts, renameSeedGroup } = await import("../../src/chrome/accountStorage");
  const { deriveSeedAccounts, addSeedPhraseGroup } = await import("../../src/chrome/mnemonic/accountHandlers");
  const { derivePrivateKey, isValidMnemonic } = await import("../../src/chrome/mnemonic/derivation");
  const { deriveAddress } = await import("../../src/chrome/localSigner");
  const { rollbackOnboardingInitialization } = await import("../../src/chrome/onboarding/lifecycle");
  const password = "a-test-only-master-password-71";
  const owner = "fresh-wallet-owner";
  const reset = () => {
    session.clearInMemoryAuthCache(); session.updateCachedAutoLockTimeout(60_000);
    for (const store of Object.values(harness.stores)) for (const key of Object.keys(store)) delete store[key];
    harness.stores.sync.autoLockTimeout = 60_000;
    harness.stores.local.onboardingInitialization = { version: 1, id: owner, startedAt: Date.now() };
    harness.clearObservations();
  };
  const initialize = async () => {
    reset();
    assert.equal((await initializeOnboardingCredential(owner, "pk-only-mode", password)).success, true);
  };
  try {
    await t.test("creation returns public account only; backup survives restart, rename and derivation", async () => {
      await initialize();
      const created = await createOnboardingSeedAccount(owner);
      assert.equal(created.success, true);
      if (!created.success || !created.account) return;
      assert.deepEqual(Object.keys(created).sort(), ["account", "success"]);
      const mnemonic = await getMnemonic(created.account.seedGroupId, { password });
      assert.ok(mnemonic && isValidMnemonic(mnemonic));
      assert.equal(deriveAddress(derivePrivateKey(mnemonic!, 0)).toLowerCase(), created.account.address.toLowerCase());
      assert.ok((await getSeedGroups())[0].backupPending);
      assert.equal(JSON.stringify(harness.snapshot("local")).includes(mnemonic!), false);
      assert.equal(JSON.stringify(harness.snapshot("session")).includes(mnemonic!), false);
      assert.equal(JSON.stringify(harness.runtimeMessages).includes(mnemonic!), false);
      assert.equal((await createOnboardingSeedAccount(owner)).success, false);
      assert.equal((await getAccounts()).length, 1);
      await renameSeedGroup(created.account.seedGroupId, "My wallet");
      assert.equal((await deriveSeedAccounts({ seedGroupId: created.account.seedGroupId, indices: [1] })).success, true);
      session.clearInMemoryAuthCache();
      assert.equal((await getSeedGroups())[0].backupPending, true);
      assert.equal((await confirmSeedBackup(created.account.seedGroupId)).success, false);
      assert.equal((await getSeedGroups())[0].backupPending, true);
      session.setCachedPasswordDirect(password); session.setCachedPasswordType("agent");
      assert.equal((await confirmSeedBackup(created.account.seedGroupId)).success, false);
      session.setCachedPasswordType("master");
      harness.failNext({ area: "local", operation: "set", key: "seedGroups" });
      assert.equal((await confirmSeedBackup(created.account.seedGroupId)).success, false);
      assert.equal((await getSeedGroups())[0].backupPending, true);
      assert.equal((await confirmSeedBackup(created.account.seedGroupId)).success, true);
      assert.equal((await getSeedGroups())[0].backupPending, undefined);
      assert.equal((await confirmSeedBackup(created.account.seedGroupId)).success, true);
      assert.equal(await getMnemonic(created.account.seedGroupId, { password }), mnemonic);
      // A structurally complete wallet is never rolled back because backup is deferred.
      assert.equal((await rollbackOnboardingInitialization(owner)).success, false);
      assert.equal((await getAccounts()).length, 2);
    });
    await t.test("concurrent creation commits exactly one wallet", async () => {
      await initialize();
      const results = await Promise.all([createOnboardingSeedAccount(owner), createOnboardingSeedAccount(owner)]);
      assert.equal(results.filter((result) => result.success).length, 1);
      assert.equal((await getAccounts()).length, 1);
      assert.equal((await getSeedGroups()).length, 1);
      assert.equal((await getSeedGroups())[0].backupPending, true);
    });
    await t.test("wrong owner and agent session cannot generate or persist", async () => {
      await initialize(); harness.clearObservations();
      assert.equal((await createOnboardingSeedAccount("wrong-owner")).success, false);
      session.setCachedPasswordType("agent");
      assert.equal((await createOnboardingSeedAccount(owner)).success, false);
      assert.deepEqual(await getAccounts(), []);
      assert.equal(harness.writes.length, 0);
    });
    await t.test("failed encryption storage leaves no orphan backup group", async () => {
      await initialize();
      harness.failNext({ area: "local", operation: "set", key: "mnemonicVault" });
      assert.equal((await createOnboardingSeedAccount(owner)).success, false);
      assert.deepEqual(await getSeedGroups(), []);
      assert.deepEqual(await getAccounts(), []);
      assert.equal((await createOnboardingSeedAccount(owner)).success, true);
    });
    await t.test("imported and legacy groups do not acquire backup reminders", async () => {
      await initialize();
      const result = await addSeedPhraseGroup({ mnemonic: "test test test test test test test test test test test junk", indices: [0] });
      assert.equal(result.success, true);
      assert.equal((await getSeedGroups())[0].backupPending, undefined);
      assert.equal((await createOnboardingSeedAccount(owner)).success, false);
    });
  } finally { session.clearInMemoryAuthCache(); harness.restore(); }
});
