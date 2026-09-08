import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelUrl = new URL(
  "../../src/components/ExplorerTransaction/ExplorerTransactionPanel.tsx",
  import.meta.url,
);

test("explorer view embeds clear-signing fields inside the leading summary", async () => {
  const source = await readFile(panelUrl, "utf8");
  const summaryIndex = source.lastIndexOf("<DecodedFunctionSummary");
  const clearSigningIndex = source.indexOf("<ClearSigningView");
  const calldataIndex = source.lastIndexOf("<CalldataDecoder");

  assert.ok(summaryIndex >= 0);
  assert.ok(clearSigningIndex > summaryIndex);
  assert.ok(calldataIndex > summaryIndex);
  assert.match(source, /details=\{[\s\S]*<ClearSigningView[\s\S]*embedded/);
  assert.match(source, /nativeSymbol=\{page\.chain\.nativeCurrency\.symbol\}/);
  assert.doesNotMatch(source, /contractAddress=/);
});

test("technical calldata starts expanded and remains collapsible", async () => {
  const source = await readFile(panelUrl, "utf8");

  assert.match(source, /<CalldataDecoder[\s\S]*collapsible/);
  assert.doesNotMatch(source, /defaultCollapsed/);
  assert.match(source, /onFunctionName=\{setFunctionName\}/);
  assert.doesNotMatch(source, /BrandWordmark/);
});

test("ERC-7821 wrappers render the shared human-readable batch call list", async () => {
  const source = await readFile(panelUrl, "utf8");

  assert.match(source, /looksLikeErc7821SelfBatch/);
  assert.match(source, /decodeErc7821Batch\(transaction\.input\)/);
  assert.match(source, /if \(batchCalls\?\.length\)/);
  assert.match(source, /<BatchCallsSummary[\s\S]*calls=\{batchCalls\}[\s\S]*hideCalldataDigest/);
});
