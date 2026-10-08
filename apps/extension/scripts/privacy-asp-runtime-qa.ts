/** Public synthetic trees only. Exercises the packaged offscreen worker without a wallet or signing. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForExtensionWorker } from "./extension-runtime-qa-support";
import { computePrivacyAspTreeRoots } from "../src/chrome/privacy/asp/treeRoots";
import { parsePrivacyAspLeaves, PRIVACY_SNARK_SCALAR_FIELD } from "../src/chrome/privacy/asp/types";

const build = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../build");
const profile = await mkdtemp(path.join(os.tmpdir(), "walletchan-asp-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: true,
  args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
});
try {
  const worker = await waitForExtensionWorker(context);
  const page = await context.newPage();
  page.on("pageerror", error => console.error("ASP QA page error", error.message));
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/onboarding.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#onboarding-root > *").first().waitFor({ state: "visible" });
  await page.bringToFront();
  const maximum = process.env.PRIVACY_ASP_QA_MAX === "1";
  const makeLeaves = (count: number) => Array.from({ length: count }, (_, index) =>
    maximum ? (PRIVACY_SNARK_SCALAR_FIELD - 1n - BigInt(index)).toString() : String(index + 1));
  const leaves = parsePrivacyAspLeaves({
    aspLeaves: makeLeaves(maximum ? 100_000 : 6_701),
    stateTreeLeaves: makeLeaves(maximum ? 100_000 : 25_000),
  });
  const expected = computePrivacyAspTreeRoots(leaves);
  const startTimer = () => {
    const state = { ticks: 0, last: performance.now(), maxGap: 0, timer: 0 };
    state.timer = Number(setInterval(() => {
      const now = performance.now(); state.maxGap = Math.max(state.maxGap, now - state.last); state.last = now; state.ticks++;
    }, 20));
    (globalThis as any).__aspQa = state;
  };
  await page.evaluate(startTimer);
  await worker.evaluate(startTimer);
  const started = Date.now();
  const result = await worker.evaluate(async (leaves) => {
    const nonce = crypto.randomUUID();
    const id = crypto.randomUUID();
    await chrome.offscreen.createDocument({
      url: `privacy-prover-offscreen.html?nonce=${nonce}`,
      reasons: [chrome.offscreen.Reason.WORKERS], justification: "Verify public synthetic ASP tree responsiveness",
    });
    try {
      return await chrome.runtime.sendMessage({ target: "walletchan-privacy-prover-offscreen-v1", nonce,
        request: { version: 1, id, kind: "request", action: "compute-tree-roots", leaves } });
    } finally { await chrome.offscreen.closeDocument(); }
  }, leaves);
  const finishTimer = () => {
    const state = (globalThis as any).__aspQa;
    clearInterval(state.timer);
    return { ticks: state.ticks, maxGapMs: Math.round(state.maxGap) };
  };
  const ui = await page.evaluate(finishTimer);
  const background = await worker.evaluate(finishTimer);
  assert.equal(result?.ok, true);
  assert.equal(result.mtRoot, expected.mtRoot);
  assert.equal(result.onchainMtRoot, expected.onchainMtRoot);
  assert.ok(ui.ticks > 5, "UI timer must run during hashing");
  assert.ok(background.ticks > 5, "Background timer must run during hashing");
  assert.ok(ui.maxGapMs < 1_000, "UI must not stall for a second");
  assert.ok(background.maxGapMs < 1_000, "Background must not stall for a second");
  console.log(JSON.stringify({ associationLeaves: leaves.aspLeaves.length, stateLeaves: leaves.stateTreeLeaves.length, workerMs: Date.now() - started, ui, background }));
} finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
