import assert from "node:assert/strict";
import test from "node:test";
import { zerionProvider } from "../app/api/portfolio/providers/zerion";
import { duneSimProvider } from "../app/api/portfolio/providers/dune";
import { alchemyProvider } from "../app/api/portfolio/providers/alchemy";

test("forced balance reads bypass provider caches, including paginated positions", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit & { next?: { revalidate?: number | false } } }> = [];
  let positionPage = 0;
  globalThis.fetch = (async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/positions/")) {
      positionPage += 1;
      return Response.json({ data: [], links: { next: positionPage % 2 === 1 ? "https://api.zerion.io/v1/wallets/test/positions/?page=2" : null } });
    }
    if (url.includes("/chains/")) return Response.json({ data: [] });
    if (url.includes("sim.dune.com")) return Response.json({ balances: [] });
    return Response.json({ data: { tokens: [] } });
  }) as typeof fetch;
  try {
    for (const provider of [zerionProvider, duneSimProvider, alchemyProvider]) {
      for (const forceRefresh of [false, true]) {
        calls.length = 0;
        await provider.fetch("0x0000000000000000000000000000000000000001", [8453], { forceRefresh });
        const balanceCalls = calls.filter(({ url }) => !url.includes("/chains/"));
        assert.ok(balanceCalls.length > 0, provider.name);
        if (provider === zerionProvider) assert.equal(balanceCalls.length, 2);
        for (const { init } of balanceCalls) {
          assert.equal(init.cache, forceRefresh ? "no-store" : undefined, provider.name);
          assert.equal(init.next?.revalidate, forceRefresh ? undefined : 60, provider.name);
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
