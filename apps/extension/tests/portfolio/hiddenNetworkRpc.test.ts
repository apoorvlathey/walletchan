import assert from "node:assert/strict";
import test from "node:test";
import { fetchOnchainBalances } from "../../src/chrome/portfolio/onchainBalances";

const token = {
  symbol: "XPL", name: "Plasma", contractAddress: "native", chainId: 9745,
  decimals: 18, balance: "1", balanceFormatted: "1", priceUsd: 1, valueUsd: 1,
};

test("hidden networks skip RPC checks, including previously cached clients", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  let hidden = true;
  let requests = 0;
  let hideDuringRequest = false;
  globalThis.chrome = { storage: { sync: { get: async () => ({
    networksInfo: { Plasma: { chainId: 9745, rpcUrl: "https://rpc.example.com", hidden } },
  }) } } } as unknown as typeof chrome;
  globalThis.fetch = async () => {
    requests += 1;
    if (hideDuringRequest) hidden = true;
    // Multicall decoding falls back to direct native balance reads.
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), {
      headers: { "content-type": "application/json" },
    });
  };
  const refresh = () => fetchOnchainBalances(
    "0x0000000000000000000000000000000000000001", [token],
    { preserveZeroBalanceTokens: true },
  );
  try {
    const skipped = await refresh();
    assert.equal(requests, 0);
    assert.deepEqual(skipped.rpcHealth, { checkedChainIds: [], unhealthyChainIds: [] });
    assert.equal(skipped.verifiedTokenKeys.size, 0);

    hidden = false;
    const visible = await refresh();
    assert.ok(requests > 0);
    assert.deepEqual(visible.rpcHealth.checkedChainIds, [9745]);
    const previousRequests = requests;

    hidden = true;
    const hiddenAgain = await refresh();
    assert.equal(requests, previousRequests);
    assert.deepEqual(hiddenAgain.rpcHealth, { checkedChainIds: [], unhealthyChainIds: [] });
    hidden = false;
    hideDuringRequest = true;
    const hiddenDuringRefresh = await refresh();
    assert.equal(requests, previousRequests + 1, "hiding during multicall prevents fallback/probe requests");
    assert.deepEqual(hiddenDuringRefresh.rpcHealth.unhealthyChainIds, []);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});
