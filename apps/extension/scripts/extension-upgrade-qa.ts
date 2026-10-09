import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress, stringToHex } from "viem";

// Only disposable profiles and public test secrets. Never use a customer's profile.
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = process.env.EXTENSION_QA_BASELINE_BUILD;
if (!baseline) throw new Error("Set EXTENSION_QA_BASELINE_BUILD to a v4.1.0 Chrome build");
const PASSWORD = "upgrade-qa-master-password", AGENT = "upgrade-qa-agent-password";
const PRIVATE_KEY = `0x${"11".repeat(32)}` as const;
const MNEMONIC = "test test test test test test test test test test test junk";
const MESSAGE = "WalletChan isolated upgrade compatibility check";
const bankr = privateKeyToAccount(`0x${"22".repeat(32)}`);
const localKeys = ["accounts", "seedGroups", "pkVault", "mnemonicVault", "privacyVault",
  "encryptedVaultKeyMaster", "encryptedVaultKeyAgent", "encryptedApiKeyVault", "agentPasswordEnabled",
  "ledgerDevices", "selectedThemeId", "addressContacts", "hiddenPortfolioTokens", "chatHistory",
  "dappPermissions", "walletConnectStorageNamespace", "privacyRecoveryBackup"];
const syncKeys = ["activeAccountId", "address", "displayAddress", "chainName", "networksInfo",
  "autoLockTimeout", "hidePortfolioValue", "swapSlippageBps", "defaultGasTier", "sidePanelMode",
  "explorerEnhancementsEnabled", "unifyPortfolioBalances", "followDappNetwork"];
async function send(page: Page, message: Record<string, unknown>): Promise<any> {
  return page.evaluate((request) => chrome.runtime.sendMessage(request), message);
}
async function ok(page: Page, message: Record<string, unknown>): Promise<any> {
  const result = await send(page, message);
  assert.ok(result?.success, `${message.type}: ${result?.error ?? "failed"}`);
  return result;
}
async function open(profile: string, extension: string) {
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true, viewport: { width: 360, height: 680 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await context.route("https://**/*", async (route) => {
      const request = route.request();
      if (request.url() === "https://api.bankr.bot/wallet/sign") {
        const body = request.postDataJSON();
        const message = `WalletChan Bankr account verification:${bankr.address.toLowerCase()}`;
        if (body?.signatureType === "personal_sign" && body.message === message) {
          await route.fulfill({ contentType: "application/json", body: JSON.stringify({
            success: true, signature: await bankr.signMessage({ message }), signer: bankr.address, signatureType: "personal_sign",
          }) }); return;
        }
      }
      await route.abort("blockedbyclient");
    });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/onboarding.html`);
    await page.waitForTimeout(1000);
    for (const other of context.pages()) if (other !== page) await other.close();
    return { context, page, id };
  } catch (error) {
    await context.close();
    throw error;
  }
}
async function snapshot(page: Page) {
  return page.evaluate(async ({ localKeys, syncKeys }) => ({
    local: await chrome.storage.local.get(localKeys), sync: await chrome.storage.sync.get(syncKeys),
  }), { localKeys, syncKeys });
}
function same(actual: unknown, expected: unknown, label: string) {
  // Do not print plaintext/ciphertext records on failure.
  assert.ok(isDeepStrictEqual(actual, expected), `${label} changed`);
}
async function signFixture(page: Page, account: any, suffix: string) {
  const id = `upgrade-sign-${suffix}-${account.id}`;
  await page.evaluate(async ({ account, id, message }) => {
    await chrome.storage.local.set({ pendingSignatureRequests: [{
      id, signature: { method: "personal_sign", params: [message, account.address], chainId: 1 },
      origin: "WalletChan", favicon: null, chainName: "Ethereum", timestamp: Date.now(),
      accountId: account.id, accountAddress: account.address.toLowerCase(), accountType: account.type, trustedInternal: true,
    }] });
  }, { account, id, message: stringToHex(MESSAGE) });
  const result = await ok(page, { type: "confirmSignatureRequest", sigId: id });
  assert.equal((await recoverMessageAddress({ message: MESSAGE, signature: result.signature })).toLowerCase(), account.address.toLowerCase());
}
async function seedReleasedProfile(page: Page, timeout: number) {
  // Released production handlers create every encrypted record.
  const begin = await ok(page, { type: "beginOnboardingInitialization", initializationId: crypto.randomUUID() });
  await ok(page, { type: "initializeOnboardingCredential", initializationId: begin.initializationId, credential: "pk-only-mode", password: PASSWORD });
  await ok(page, { type: "addPrivateKeyAccount", privateKey: PRIVATE_KEY, displayName: "Upgrade local" });
  const local = (await send(page, { type: "getAccounts" })).find((account: any) => account.type === "privateKey");
  assert.ok(local, "released local account missing");
  await page.evaluate(async (address) => chrome.storage.sync.set({ address, displayAddress: "Upgrade local", chainName: "Ethereum" }), local.address);
  await ok(page, { type: "completeOnboardingInitialization", initializationId: begin.initializationId });
  const seed = await ok(page, { type: "addSeedPhraseGroup", mnemonic: MNEMONIC, indices: [0, 1], name: "Existing seed" });
  await ok(page, { type: "addBankrAccount", address: bankr.address, apiKey: "isolated-upgrade-fixture", displayName: "Upgrade Bankr" });
  await ok(page, { type: "addImpersonatorAccount", address: `0x${"33".repeat(20)}`, displayName: "Upgrade watch" });
  await ok(page, { type: "setAgentPassword", masterPassword: PASSWORD, agentPassword: AGENT });
  await ok(page, { type: "unlockWallet", password: PASSWORD });
  await ok(page, { type: "setActiveAccount", accountId: seed.accounts[1].id });
  await ok(page, { type: "privacyEnsureInitialized" });
  await ok(page, { type: "ensureNetworksInfo" });
  await ok(page, { type: "setActiveAccount", accountId: seed.accounts[1].id });
  await page.evaluate(async ({ timeout }) => {
    const { accounts } = await chrome.storage.local.get("accounts");
    const device = `0x${"44".repeat(20)}`;
    // Public metadata only; device signing and Safe authority are separate tests.
    accounts.push({ id: "upgrade-ledger", type: "ledger", address: device, deviceId: device,
      hdPath: "m/44'/60'/0'/0/0", hdIndex: 0, displayName: "Existing Ledger", createdAt: Date.now() });
    accounts.push({ id: "upgrade-safe", type: "safe", address: `0x${"55".repeat(20)}`, displayName: "Existing Safe", createdAt: Date.now() });
    await chrome.storage.local.set({ accounts, ledgerDevices: { [device]: { label: "Existing device", model: "nanoX", addedAt: Date.now() } },
      selectedThemeId: "bauhaus", addressContacts: [{ address: `0x${"66".repeat(20)}`, label: "Existing contact", createdAt: Date.now() }],
      hiddenPortfolioTokens: [{ chainId: 1, contractAddress: `0x${"77".repeat(20)}`, hiddenAt: Date.now() }],
      chatHistory: [{ id: "upgrade-chat", title: "Existing conversation", messages: [], createdAt: Date.now(), updatedAt: Date.now() }],
    });
    const { networksInfo } = await chrome.storage.sync.get("networksInfo");
    networksInfo.Ethereum.rpcUrl = "https://example.com/rpc";
    networksInfo.Ethereum.explorer = "https://example.com/explorer";
    networksInfo.Base.hidden = true;
    networksInfo["QA Custom"] = { chainId: 31337, rpcUrl: "https://example.org/rpc", isCustom: true,
      explorer: "https://example.org/explorer", nativeCurrency: { name: "QA", symbol: "QA", decimals: 18 } };
    await chrome.storage.sync.set({ networksInfo, autoLockTimeout: timeout, sidePanelMode: false,
      hidePortfolioValue: true, swapSlippageBps: 75, defaultGasTier: "fast", explorerEnhancementsEnabled: false,
      unifyPortfolioBalances: false, followDappNetwork: false });
    await chrome.storage.local.set({ txHistory: [{ id: "upgrade-history", status: "success", origin: "WalletChan",
      favicon: null, chainName: "Ethereum", chainId: 1, createdAt: Date.now(), completedAt: Date.now(),
      tx: { from: accounts[0].address, to: `0x${"66".repeat(20)}`, value: "0x0", data: "0x", chainId: 1 },
      txHash: `0x${"88".repeat(32)}`, accountType: "privateKey", assetChanges: { version: 2, blockNumber: "123", nativeDelta: "0",
        erc20Transfers: [{ token: `0x${"77".repeat(20)}`, direction: "in", counterparty: `0x${"66".repeat(20)}`, amountWei: "123", symbol: "QA", decimals: 18 }] },
    }] });
  }, { timeout });
  await ok(page, { type: "ensureNetworksInfo" });
  await signFixture(page, local, "before");
  await signFixture(page, seed.accounts[0], "before");
  await ok(page, { type: "lockWallet" });
  return { local, seed, stored: await snapshot(page) };
}
async function verifyUpgrade(page: Page, id: string, before: Awaited<ReturnType<typeof seedReleasedProfile>> & { history: unknown; pending: unknown[] }, cycle: number) {
  assert.equal((await send(page, { type: "getOnboardingInitializationStatus" })).configured, true);
  same(await send(page, { type: "getPendingSignatureRequests" }), cycle === 1 ? before.pending : [], "pending signature queue");
  const stored = await snapshot(page);
  for (const key of localKeys) same(stored.local[key], before.stored.local[key], `local.${key}`);
  for (const key of syncKeys) same(stored.sync[key], before.stored.sync[key], `sync.${key}`);
  same(await send(page, { type: "getTxHistoryItem", txId: "upgrade-history" }), before.history, "IndexedDB transaction + transfers");
  await page.goto(`chrome-extension://${id}/index.html`);
  await page.getByLabel("Enter password to unlock", { exact: true }).waitFor();
  assert.equal((await send(page, { type: "unlockWallet", password: "wrong-upgrade-password" })).success, false);
  await page.getByLabel("Enter password to unlock", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  if (cycle === 1) {
    await page.getByRole("heading", { name: "Signature request", exact: true }).waitFor();
    await page.getByRole("button", { name: "Reject", exact: true }).click();
  }
  await page.getByRole("button", { name: "Lock wallet", exact: true }).first().waitFor();
  await ok(page, { type: "privacyEnsureInitialized" });
  for (const account of [before.local, ...before.seed.accounts]) await signFixture(page, account, `master-${cycle}`);
  assert.ok((await ok(page, { type: "revealPrivateKey", accountId: before.local.id, password: PASSWORD })).privateKey === PRIVATE_KEY, "private key recovery changed");
  assert.ok((await ok(page, { type: "revealSeedPhrase", seedGroupId: before.seed.group.id, password: PASSWORD })).mnemonic === MNEMONIC, "seed recovery changed");
  await ok(page, { type: "lockWallet" });
  assert.equal((await ok(page, { type: "unlockWallet", password: AGENT })).passwordType, "agent");
  for (const account of [before.local, ...before.seed.accounts]) await signFixture(page, account, `agent-${cycle}`);
  assert.equal((await send(page, { type: "revealPrivateKey", accountId: before.local.id, password: AGENT })).success, false);
  await ok(page, { type: "lockWallet" });
  const after = await snapshot(page);
  for (const key of localKeys) same(after.local[key], before.stored.local[key], `after unlock local.${key}`);
}
async function run(timeout: number) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walletchan-upgrade-qa-"));
  const extension = path.join(dir, "extension"), profile = path.join(dir, "profile");
  let context: BrowserContext | undefined;
  try {
    await cp(baseline!, extension, { recursive: true });
    const oldManifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
    assert.equal(oldManifest.version, "4.1.0");
    let opened = await open(profile, extension); context = opened.context;
    const id = opened.id, seeded = await seedReleasedProfile(opened.page, timeout);
    await context.close(); context = undefined;
    // Restart the released worker so its one-time legacy-history migration runs.
    opened = await open(profile, extension); context = opened.context;
    const history = await send(opened.page, { type: "getTxHistoryItem", txId: "upgrade-history" });
    assert.ok(history?.id === "upgrade-history", "released history did not migrate to IndexedDB");
    const pending = [{ id: "upgrade-existing-request", origin: "WalletChan", favicon: null,
      chainName: "Ethereum", timestamp: Date.now(), trustedInternal: true,
      accountId: seeded.local.id, accountType: "privateKey", accountAddress: seeded.local.address.toLowerCase(),
      signature: { method: "personal_sign", params: [stringToHex(MESSAGE), seeded.local.address], chainId: 1 } }];
    await opened.page.evaluate((records) => chrome.storage.local.set({ pendingSignatureRequests: records }), pending);
    const before = { ...seeded, history, pending, stored: await snapshot(opened.page) };
    await rm(extension, { recursive: true, force: true });
    await cp(path.join(app, "build"), extension, { recursive: true });
    const manifestPath = path.join(extension, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    // Version/observer changes are confined to the disposable build copy.
    manifest.version = "4.1.0.1"; manifest.key = oldManifest.key;
    await writeFile(manifestPath, JSON.stringify(manifest));
    await appendFile(path.join(extension, manifest.background.service_worker),
      '\nchrome.runtime.onInstalled.addListener(d => chrome.storage.local.set({upgradeQaInstallEvent:{reason:d.reason,previousVersion:d.previousVersion}}));\n');
    for (let cycle = 1; cycle <= 2; cycle++) {
      if (cycle === 2) {
        opened = await open(profile, extension); context = opened.context;
        assert.equal(opened.id, id, "extension identity changed");
      }
      const currentContext = opened.context;
      const browser = currentContext.browser();
      assert.ok(browser, "Browser CDP session unavailable");
      const cdp = await browser.newBrowserCDPSession();
      const installed = await cdp.send("Extensions.loadUnpacked", { path: extension });
      assert.equal(installed.id, id, "extension identity changed");
      opened.page = await currentContext.newPage();
      await opened.page.goto(`chrome-extension://${id}/onboarding.html`);
      let event: any;
      for (let attempt = 0; attempt < 100; attempt++) {
        event = await opened.page.evaluate(async () => (await chrome.storage.local.get("upgradeQaInstallEvent")).upgradeQaInstallEvent);
        if (event?.reason === "update") break;
        await opened.page.waitForTimeout(100);
      }
      assert.ok(event?.reason === "update", "Chrome update event was not observed");
      assert.equal(event.previousVersion, cycle === 1 ? "4.1.0" : "4.1.0.1");
      await verifyUpgrade(opened.page, id, before, cycle);
      console.log(`✓ v4.1.0 upgrade: ${timeout === 0 ? "Never" : "15-minute"} auto-lock, cycle ${cycle}: records, history, master/agent unlock, local signing and recovery`);
      await currentContext.close(); context = undefined;
    }
  } finally {
    await context?.close(); await rm(dir, { recursive: true, force: true });
  }
}
for (const timeout of [900_000, 0]) await run(timeout);
