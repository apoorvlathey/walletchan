import assert from "node:assert/strict";
import test from "node:test";
import { fetchPortfolio } from "../../src/chrome/portfolio/api";

test("explicit refresh bypasses the HTTP cache and requests fresh server balances", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; cache?: RequestCache }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), cache: init?.cache });
    return Response.json({ tokens: [], defiPositions: [], totalValueUsd: 0 });
  }) as typeof fetch;
  try {
    const address = "0x0000000000000000000000000000000000000001";
    await fetchPortfolio(address);
    await fetchPortfolio(address, undefined, { forceRefresh: true });
    assert.equal(new URL(calls[0].url).searchParams.has("refresh"), false);
    // The bounded transport already disables the browser cache for all reads.
    assert.equal(calls[0].cache, "no-store");
    assert.equal(new URL(calls[1].url).searchParams.get("refresh"), "1");
    assert.equal(calls[1].cache, "no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
