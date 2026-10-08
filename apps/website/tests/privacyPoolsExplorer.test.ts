import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, parseAbiParameters } from "viem";
import { POST } from "../app/api/privacy-pools-explorer/route";
import { DEPOSIT_EVENT, DEPLOYMENTS, fetchBoundedJson, parseAspLeaves } from "../app/api/privacy-pools-explorer/verification";
import { MAX_PRIVACY_ASP_LEAVES_PER_TREE } from "@walletchan/shared/privacy/aspPolicy";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const HASH = `0x${"22".repeat(32)}`;
const unique = (count: number) => Array.from({ length: count }, (_, index) => String(index + 1));

test("explorer verifies approved deposit metadata beyond 10k and reuses only the public snapshot", async () => {
  const originalFetch = globalThis.fetch;
  let leafReads = 0;
  let chainReads = 0;
  const deployment = DEPLOYMENTS.mainnet;
  const log = {
    address: deployment.ethPool,
    topics: encodeEventTopics({ abi: [DEPOSIT_EVENT], eventName: "Deposited", args: { _depositor: ADDRESS } }),
    data: encodeAbiParameters(parseAbiParameters("uint256, uint256, uint256, uint256"), [20n, 10n, 100n, 30n]),
    blockNumber: "0x1", blockHash: HASH, transactionHash: HASH, transactionIndex: "0x0", logIndex: "0x0", removed: false,
  };
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.includes("mt-roots")) return Response.json({ mtRoot: "10", onchainMtRoot: "20", createdAt: "2026-10-08T08:55:22.036Z" });
    if (url.includes("mt-leaves")) { leafReads++; return Response.json({ aspLeaves: unique(6_701), stateTreeLeaves: unique(13_068) }); }
    if (url.includes("deposits-by-label")) return Response.json([{ type: "deposit", amount: "100", address: ADDRESS, label: "10", txHash: HASH, timestamp: 1, precommitmentHash: "30", reviewStatus: "approved" }]);
    const rpc = JSON.parse(String(init?.body));
    let result: unknown;
    if (rpc.method === "eth_getTransactionReceipt") result = {
      transactionHash: HASH, transactionIndex: "0x0", blockHash: HASH, blockNumber: "0x1", from: ADDRESS, to: deployment.entrypoint,
      cumulativeGasUsed: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1", contractAddress: null, logs: [log], logsBloom: `0x${"00".repeat(256)}`, status: "0x1", type: "0x2",
    };
    else if (rpc.method === "eth_getBlockByNumber") result = { number: "0x1", hash: HASH, timestamp: "0x1", transactions: [] };
    else if (rpc.method === "eth_call") { chainReads++; result = `0x${"0".repeat(63)}a`; }
    else throw new Error(`Unexpected RPC ${rpc.method}`);
    return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
  }) as typeof fetch;
  try {
    for (let iteration = 0; iteration < 2; iteration++) {
      const response = await POST(new Request("http://localhost/api/privacy-pools-explorer", {
        method: "POST", body: JSON.stringify({ network: "mainnet", transaction: HASH }),
      }));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.asp.reviewStatus, "approved");
      assert.equal(body.asp.exactDepositMatch, true);
      assert.equal(body.asp.labelIncluded, true);
      assert.equal(body.onchain.rootMatches, true);
      assert.equal(body.status, "confirmed");
    }
    assert.equal(leafReads, 1);
    assert.equal(chainReads, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("website shares strict growth budgets with the extension", () => {
  assert.equal(parseAspLeaves({ aspLeaves: ["1"], stateTreeLeaves: unique(25_000) }).stateTreeLeaves.length, 25_000);
  assert.throws(() => parseAspLeaves({ aspLeaves: ["1"], stateTreeLeaves: unique(MAX_PRIVACY_ASP_LEAVES_PER_TREE + 1) }), /capacity/);
  assert.throws(() => parseAspLeaves({ aspLeaves: ["1", "1"], stateTreeLeaves: ["2"] }));
});

test("streamed ASP bodies enforce actual byte limits even without content-length", async () => {
  const originalFetch = globalThis.fetch;
  let cancelled = false;
  globalThis.fetch = (async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode("12345")); },
    cancel() { cancelled = true; },
  }))) as typeof fetch;
  try {
    await assert.rejects(fetchBoundedJson("https://example.test", {}, 8), /too large/);
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = originalFetch; }
});
