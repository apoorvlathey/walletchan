import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { compactBackground } from "../../scripts/build/compactBackground";

async function render(code: string, format = "es", fileName = "background.js", sourcemap = false) {
  const hook = compactBackground().renderChunk;
  assert.equal(typeof hook, "function");
  return (hook as Function)(code, { fileName }, { format, sourcemap });
}

test("background formatting preserves names, execution order, strings, and licenses", async () => {
  const source = `
    /*! @license keep this notice */
    const events = [];
    class WalletSession {
      constructor() { events.push("created"); }
      label() { return this.constructor.name; }
    }
    function resolveWebsite(name) {
      events.push(name);
      return /\\.gwei$/.test(name) ? "https://" + name + ".domains" : null;
    }
    const session = new WalletSession();
    const url = resolveWebsite("site.gwei");
    globalThis.result = JSON.stringify({ events, url, label: session.label(), fn: resolveWebsite.name,
      unicode: "WalletChan → Settings", bigint: String(12345678901234567890n),
      boundary: "The nonce must be less than 2 ^ 128" });
  `;
  const output = await render(source);
  assert.ok(output && output.code.length < source.length);
  assert.match(output.code, /@license keep this notice/);
  assert.match(output.code, /The nonce must be less than 2 \^ 128/);
  const before = { result: "" };
  const after = { result: "" };
  runInNewContext(source, before);
  runInNewContext(output.code, after);
  assert.equal(after.result, before.result);
});

test("formatting targets only the Chromium background and can emit source maps", async () => {
  assert.equal(await render("const keep = 1;", "iife"), null);
  assert.equal(await render("const keep = 1;", "es", "offscreen.js"), null);
  const result = await render("export const keep = 1;", "es", "background.js", true);
  assert.match(result.code, /export const keep=1/);
  assert.ok(result.map);
});
