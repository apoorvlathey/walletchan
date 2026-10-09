import assert from "node:assert/strict";
import test from "node:test";
import { submitOnboardingAccount } from "../../src/pages/onboarding/onboardingSubmission";
import type { SafeOnboardingSelection } from "../../src/pages/onboarding/safeOnboarding";

const address = "0x1111111111111111111111111111111111111111";
const selection: SafeOnboardingSelection = { address, verificationIds: ["old"], snapshots: [{
  chainId: 1, configEpoch: `0x${"ab".repeat(32)}`, verifiedAtBlock: "1", singleton: address,
  version: "1.4.1", owners: [address], contractOwners: [], threshold: 1, nonce: "0", modules: [],
  guard: address, fallbackHandler: address, transactionService: "supported", capability: "observe",
}] };
function install(options: { changed?: boolean; missing?: boolean; importError?: boolean; agent?: boolean } = {}) {
  const calls: any[] = []; const writes: any[] = [];
  (globalThis as any).chrome = {
    runtime: { sendMessage: async (message: any) => {
      calls.push(message);
      switch (message.type) {
        case "beginOnboardingInitialization": return { success: true, initializationId: "owner" };
        case "initializeOnboardingCredential": return { success: true, passwordType: options.agent ? "agent" : "master" };
        case "probeSafeAddress": return { ...selection, verificationIds: ["fresh"], snapshots: options.missing ? [] : selection.snapshots.map((snapshot) => ({ ...snapshot, configEpoch: options.changed ? "changed" : snapshot.configEpoch })) };
        case "importSafeAccount": return options.importError ? { success: false, error: "Import failed" } : { success: true, account: { address, displayName: "Safe" } };
        default: return { success: true };
      }
    } },
    storage: { sync: { set: async (value: any) => { writes.push(value); }, get: async () => ({ isArcBrowser: true }) } },
  };
  (globalThis as any).sessionStorage = { removeItem() {} };
  return { calls, writes };
}
function input(safeSelection: SafeOnboardingSelection | null = selection) {
  return { initializationOwnerId: "owner", accountType: "safe" as const, password: "Test-password1!", apiKey: "", walletAddress: "", bankrDisplayName: "", privateKey: "", privateKeyDisplayName: "", viewOnlyAddress: "", viewOnlyDisplayName: "", mnemonic: "", seedIndices: [0], seedGroupName: "", seedAccountDisplayName: "", ledgerSelection: null, safeSelection, resolveAddress: async () => null };
}

test("Safe onboarding establishes master authority, refreshes receipts, imports reviewed chains and selects their network", async () => {
  const { calls, writes } = install();
  await submitOnboardingAccount(input());
  assert.deepEqual(calls.slice(0, 5).map((call) => call.type), ["beginOnboardingInitialization", "initializeOnboardingCredential", "probeSafeAddress", "importSafeAccount", "completeOnboardingInitialization"]);
  const imported = calls.find((call) => call.type === "importSafeAccount");
  assert.deepEqual(imported.verificationIds, ["fresh"]);
  assert.deepEqual(imported.chainIds, [1]);
  assert.equal(imported.address, address);
  assert.equal(writes[0].chainName, "Ethereum");
  assert.ok(!calls.some((call) => /generate|addPrivateKey|addSeed|addLedger|addBankr/.test(call.type)));
});
for (const options of [{ changed: true }, { missing: true }, { importError: true }, { agent: true }]) {
  test(`Safe onboarding fails closed and rolls back: ${JSON.stringify(options)}`, async () => {
    const { calls, writes } = install(options);
    await assert.rejects(submitOnboardingAccount(input()));
    assert.equal(calls.at(-1).type, "rollbackOnboardingInitialization");
    assert.equal(writes.length, 0);
    assert.ok(!calls.some((call) => call.type === "completeOnboardingInitialization"));
    if (!options.importError) assert.ok(!calls.some((call) => call.type === "importSafeAccount"));
  });
}
test("Safe without reviewed networks cannot start credential setup", async () => {
  const { calls } = install();
  await assert.rejects(submitOnboardingAccount(input(null)), /verify your Safe/);
  assert.equal(calls.length, 0);
});
