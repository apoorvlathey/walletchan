import assert from "node:assert/strict";
import test from "node:test";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import { MAX_PRIVACY_ASP_LEAVES_PER_TREE, parsePrivacyAspLeaves } from "../../src/chrome/privacy/asp/types";
import { computePrivacyAspTreeRoots, privacyAspTreeRoot } from "../../src/chrome/privacy/asp/treeRoots";
import { createPrivacyAspSnapshotLoader } from "../../src/chrome/privacy/asp/snapshot";
import { hasVerifiedPrivacyAspMembership } from "../../src/chrome/privacy/asp/treeEvidence";
import { createRootSnapshotCache } from "@walletchan/shared/privacy/rootSnapshotCache";
import { parsePrivacyAspTreeRequest, parsePrivacyAspTreeResult } from "../../src/chrome/privacy/asp/treeMessages";
import { createPrivacyProverCoordinator } from "../../src/chrome/privacy/prover/coordinator";

const unique = (count: number, offset = 1) => Array.from({ length: count }, (_, index) => String(index + offset));
const roots = { mtRoot: "1", onchainMtRoot: "2", createdAt: "2026-10-08T08:55:22.036Z" };
const ID = "00000000-0000-4000-8000-000000000000";

test("mainnet-sized and larger unique trees pass; resource budget rejects independently of duplicate validation", () => {
  for (const count of [13_068, 25_000, MAX_PRIVACY_ASP_LEAVES_PER_TREE]) {
    const leaves = parsePrivacyAspLeaves({ aspLeaves: unique(6_701), stateTreeLeaves: unique(count) });
    assert.equal(leaves.stateTreeLeaves.length, count);
    assert.equal(Object.isFrozen(leaves.stateTreeLeaves), true);
  }
  assert.throws(() => parsePrivacyAspLeaves({ aspLeaves: ["1"], stateTreeLeaves: unique(MAX_PRIVACY_ASP_LEAVES_PER_TREE + 1) }), /capacity/);
  for (const bad of [["1", "1"], ["0"], ["01"], ["-1"], ["21888242871839275222246405745257275088548364400416034343698204186575808495617"]]) {
    assert.throws(() => parsePrivacyAspLeaves({ aspLeaves: bad, stateTreeLeaves: ["2"] }));
  }
});

test("worker tree hashing agrees with the pinned SDK for odd trees, powers of two, and a tree beyond the old ceiling", () => {
  for (const count of [1, 2, 3, 5, 8, 17, 10_001]) {
    const leaves = unique(count);
    assert.equal(privacyAspTreeRoot(leaves), generateMerkleProof(leaves.map(BigInt), BigInt(leaves.at(-1)!)).root.toString());
  }
});

test("snapshot reuse hashes once, shares concurrent loads, and rechecks onchain authority every time", async () => {
  let leafReads = 0;
  let hashes = 0;
  let chainReads = 0;
  let chainRoot = 1n;
  let current = roots;
  const leaves = parsePrivacyAspLeaves({ aspLeaves: ["10", "11"], stateTreeLeaves: ["20", "21"] });
  const loader = createPrivacyAspSnapshotLoader({
    readRoots: async () => current,
    readLeaves: async () => { leafReads++; return leaves; },
    computeRoots: async () => { hashes++; return current; },
    readOnchain: async () => { chainReads++; return { associationRoot: chainRoot, verifiedStateRoot: BigInt(current.onchainMtRoot) }; },
  });
  const [first, second] = await Promise.all([loader.get(), loader.get()]);
  assert.equal(first.leaves, second.leaves);
  await loader.get();
  assert.equal(leafReads, 1);
  assert.equal(hashes, 1);
  assert.equal(chainReads, 3);
  assert.equal(hasVerifiedPrivacyAspMembership({ ...first, label: "10", commitment: "20" }), true);
  assert.equal(hasVerifiedPrivacyAspMembership({ ...first, label: "12", commitment: "20" }), false);
  chainRoot = 99n;
  await assert.rejects(loader.get(), /active Privacy Pools deployment/);
  assert.equal(hashes, 1);
  current = { ...roots, mtRoot: "99" };
  await loader.get();
  assert.equal(hashes, 2);
});

test("bad snapshot hashing never becomes cached approval evidence", async () => {
  let hashes = 0;
  const loader = createPrivacyAspSnapshotLoader({
    readRoots: async () => roots,
    readLeaves: async () => parsePrivacyAspLeaves({ aspLeaves: ["1"], stateTreeLeaves: ["2"] }),
    computeRoots: async () => { hashes++; return { mtRoot: "999", onchainMtRoot: "2" }; },
    readOnchain: async () => { throw new Error("Must not reach authority read"); },
  });
  await assert.rejects(loader.get(), /membership roots/);
  await assert.rejects(loader.get(), /membership roots/);
  assert.equal(hashes, 2);
});

test("root changes during download retry one coherent snapshot; clear prevents late publication", async () => {
  let current = roots;
  let loads = 0;
  const cache = createRootSnapshotCache({
    readRoots: async () => current,
    load: async () => { loads++; current = { ...roots, mtRoot: "3" }; return loads; },
  });
  assert.equal((await cache.get()).data, 2);
  assert.equal((await cache.get()).data, 2);
  assert.equal(loads, 2);
  let release!: () => void;
  const pendingCache = createRootSnapshotCache({ readRoots: async () => roots, load: () => new Promise<void>(resolve => { release = resolve; }) });
  const pending = pendingCache.get();
  await new Promise(resolve => setImmediate(resolve));
  pendingCache.clear();
  release();
  await assert.rejects(pending, /invalidated/);
});

test("empty, malformed, changing, or unavailable snapshots never fall back to cached success", async () => {
  let fail = false;
  let current = roots;
  const cache = createRootSnapshotCache({ readRoots: async () => { if (fail) throw new Error("offline"); return current; }, load: async () => "ok" });
  await cache.get(); fail = true;
  await assert.rejects(cache.get(), /offline/);
  fail = false; current = { ...roots, onchainMtRoot: "4" };
  assert.equal((await cache.get()).roots.onchainMtRoot, "4");
  let count = 0;
  const moving = createRootSnapshotCache({ readRoots: async () => ({ ...roots, mtRoot: String(++count) }), load: async () => 1 });
  await assert.rejects(moving.get(), /changed during verification/);
});

test("public tree job uses the nonce-bound coordinator and validates worker responses", async () => {
  const leaves = parsePrivacyAspLeaves({ aspLeaves: ["1"], stateTreeLeaves: ["2"] });
  const request = { version: 1, id: ID, kind: "request", action: "compute-tree-roots", leaves } as const;
  assert.deepEqual(parsePrivacyAspTreeRequest(request), request);
  assert.equal(parsePrivacyAspTreeRequest({ ...request, masterKeys: {} }), null);
  assert.equal(parsePrivacyAspTreeResult({ version: 1, id: ID, kind: "result", action: "compute-tree-roots", ok: true, mtRoot: "0", onchainMtRoot: "2" }), null);
  let closes = 0;
  const coordinator = createPrivacyProverCoordinator({
    getUrl: path => `chrome-extension://test/${path}`,
    available: () => true,
    listOffscreenDocumentUrls: async () => [],
    createOffscreenDocument: async () => undefined,
    closeOffscreenDocument: async () => { closes++; },
    randomUuid: () => ID,
    sendRuntimeMessage: async (raw) => {
      const message = raw as { nonce: string; request: typeof request };
      assert.equal(message.nonce, ID);
      assert.deepEqual(message.request, request);
      return { version: 1, id: ID, kind: "result", action: "compute-tree-roots", ok: true, ...computePrivacyAspTreeRoots(leaves) };
    },
  });
  assert.equal((await coordinator.computeTreeRoots(leaves)).mtRoot, "1");
  assert.equal(closes, 1);
});
