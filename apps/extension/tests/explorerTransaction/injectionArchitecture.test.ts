import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const injectionUrl = new URL(
  "../../src/chrome/explorerTransaction/injection.ts",
  import.meta.url,
);

test("explorer injection follows soft navigation independently of page mutations", async () => {
  const source = await readFile(injectionUrl, "utf8");

  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /lastUrl !== window\.location\.href/);
  assert.match(source, /extractExplorerTransactionHash\(window\.location\.pathname\)/);
  assert.match(source, /NAVIGATION_POLL_MS = 400/);
});

test("explorer injection mounts a selectable peer inside native Input Data", async () => {
  const source = await readFile(injectionUrl, "utf8");

  assert.match(source, /document\.getElementById\("rawtab"\)/);
  assert.match(source, /document\.getElementById\("inputdata"\)/);
  assert.match(source, /container\.insertBefore\(host, container\.firstChild\)/);
  assert.match(source, /createTab\(getExplorerSiteName\(page\.pageUrl\)/);
  assert.match(source, /createTab\("WalletChan", "wallet"\)/);
});

test("WalletChan is the default responsive view while the explorer remains selectable", async () => {
  const source = await readFile(injectionUrl, "utf8");

  assert.match(source, /const ensureFrame = \(\) => \{/);
  assert.match(source, /if \(walletSelected\) ensureFrame\(\)/);
  assert.match(source, /selectTab\("wallet"\)/);
  assert.match(source, /\.panel \{ width: 52%; min-width: 520px; max-width: 880px; margin: 0;/);
  assert.match(source, /@media \(max-width: 900px\) \{ \.panel \{ width: 100%; min-width: 0;/);
  assert.doesNotMatch(source, /container\.insertBefore\(frame/);
});

test("explorer injection is preference-gated before page resolution or RPC work", async () => {
  const source = await readFile(injectionUrl, "utf8");

  assert.match(source, /let explorerEnhancementsEnabled = false/);
  assert.match(source, /if \(!explorerEnhancementsEnabled\) \{\s*removeExistingHost\(\);\s*return;/);
  assert.match(source, /getExplorerEnhancementsEnabled\(\)\.then/);
  assert.match(source, /changes\[EXPLORER_ENHANCEMENTS_STORAGE_KEY\]/);
});
