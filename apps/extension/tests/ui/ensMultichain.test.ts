import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, encodeAbiParameters, encodeFunctionResult, parseAbi, type Hex } from "viem";
import { ensCoinType, resolveNameToAddress, resolveAddressToName, isNameForAddress } from "../../src/lib/ensUtils";
import { resolveEnsIdentitiesBatch } from "../../src/lib/ensBatchIdentity";
import { ensIdentityKey, getEnsIdentityCache, isCacheValid, resolveAndCacheIdentity } from "../../src/lib/ensIdentityCache";

const ETH = "0x982bb9d000bfee18fd68c11505c11a4f900b2179";
const BASE = "0xccc850cd55d809c1330ceeb30ea630881cb5679a";
const RESOLVER = "0x1111111111111111111111111111111111111111";
const abi = parseAbi([
  "function resolveWithGateways(bytes name, bytes data, string[] gateways) view returns (bytes, address)",
  "function reverseWithGateways(bytes addressBytes, uint256 coinType, string[] gateways) view returns (string, address, address)",
  "function coinType() view returns (uint256)",
  "function nameForAddr(address addr) view returns (string)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
  "function text(bytes32 node, string key) view returns (string)",
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])",
]);

function installResolver(l2Fallback = false) {
  const previousFetch = globalThis.fetch;
  const previousChrome = globalThis.chrome;
  let cache: Record<string, unknown> = {};
  let fail = false;
  const queried: bigint[] = [];
  const records = new Map<bigint, Hex>([[60n, ETH], [2147483648n, ETH], [2147492101n, BASE]]);
  const execute = (data: Hex): Hex => {
    const call = decodeFunctionData({ abi, data });
    if (call.functionName === "aggregate3") return encodeFunctionResult({ abi, functionName: "aggregate3", result: call.args[0].map(({callData}) => {
      try { return { success: true, returnData: execute(callData) }; }
      catch { return { success: false, returnData: "0x" as Hex }; }
    }) });
    if (call.functionName === "coinType") return encodeFunctionResult({ abi, functionName: "coinType", result: 2147492101n });
    if (call.functionName === "nameForAddr") return encodeFunctionResult({ abi, functionName: "nameForAddr", result: "onshow.eth" });
    if (call.functionName === "reverseWithGateways") {
      if (l2Fallback) throw new Error("Gateway proof unavailable");
      queried.push(call.args[1]);
      // Deliberately return a mismatched primary name: the wallet must verify it.
      return encodeFunctionResult({ abi, functionName: "reverseWithGateways", result: ["onshow.eth", RESOLVER, RESOLVER] });
    }
    if (call.functionName === "resolveWithGateways") {
      const inner = decodeFunctionData({ abi, data: call.args[1] });
      if (inner.functionName === "addr") {
        queried.push(inner.args[1]);
        const value = records.get(inner.args[1]) ?? "0x";
        return encodeFunctionResult({ abi, functionName: "resolveWithGateways", result: [encodeAbiParameters([{type:"bytes"}], [value]), RESOLVER] });
      }
      return encodeFunctionResult({ abi, functionName: "resolveWithGateways", result: [encodeAbiParameters([{type:"string"}], [""]), RESOLVER] });
    }
    throw new Error("No record");
  };
  globalThis.chrome = { storage: {
    sync: { get: async () => ({}) },
    local: { get: async () => ({ensIdentityCache: structuredClone(cache)}), set: async (value: Record<string, unknown>) => { cache = value.ensIdentityCache as Record<string, unknown>; } },
  } } as unknown as typeof chrome;
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    let response;
    try {
      if (fail) throw new Error("RPC unavailable");
      response = {jsonrpc:"2.0", id:request.id, result:execute(request.params[0].data)};
    } catch { response = {jsonrpc:"2.0", id:request.id, error:{code:-32000, message:"RPC unavailable"}}; }
    return new Response(JSON.stringify(response), {status:200, headers:{"content-type":"application/json"}});
  }) as typeof fetch;
  return { records, queried, fail: () => {fail = true;}, restore: () => {globalThis.fetch = previousFetch; globalThis.chrome = previousChrome;} };
}

test("ENSIP-11 coin types keep Ethereum, default, and Base distinct without truncating custom IDs", () => {
  assert.equal(ensCoinType(1), 60n);
  assert.equal(ensCoinType(0), 2147483648n);
  assert.equal(ensCoinType(8453), 2147492101n);
  for (const invalid of [-1, 1.5, NaN, 2147483648, 999999999999]) assert.throws(() => ensCoinType(invalid));
});

test("Send resolution selects the Base override and fails closed on missing or invalid records", async () => {
  const mock = installResolver();
  try {
    assert.equal(await resolveNameToAddress("onshow.eth", 8453), BASE);
    assert.equal(await resolveNameToAddress("onshow.eth", 1), ETH);
    assert.equal(await resolveNameToAddress("onshow.eth"), ETH);
    mock.records.set(2147492101n, ETH); // The resolver applies its explicit default.
    assert.equal(await resolveNameToAddress("onshow.eth", 8453), ETH);
    mock.records.delete(2147492101n);
    mock.queried.length = 0;
    assert.equal(await resolveNameToAddress("onshow.eth", 8453), null);
    assert.deepEqual(mock.queried, [2147492101n]); // No Ethereum/default client fallback.
    mock.records.set(2147492101n, "0x1234");
    assert.equal(await resolveNameToAddress("onshow.eth", 8453), null);
    mock.fail();
    await assert.rejects(resolveNameToAddress("onshow.eth", 8453));
  } finally {mock.restore();}
});

test("single and batched reverse resolution reject a mainnet-only name on Base", async () => {
  const mock = installResolver();
  try {
    assert.equal(await resolveAddressToName(ETH, 8453), null);
    assert.equal(await resolveAddressToName(BASE, 8453), "onshow.eth");
    assert.equal(await isNameForAddress("onshow.eth", ETH, 8453), false);
    const result = await resolveEnsIdentitiesBatch([ETH, BASE], new Map(), 8453);
    assert.equal(result.get(ETH)?.name, null);
    assert.equal(result.get(BASE)?.name, "onshow.eth");
    const hinted = await resolveEnsIdentitiesBatch([ETH], new Map([[ETH, "onshow.eth"]]), 8453);
    assert.equal(hinted.get(ETH)?.name, null);
  } finally {mock.restore();}
});

test("cached identities cannot cross network boundaries", async () => {
  const mock = installResolver();
  try {
    await resolveAndCacheIdentity(ETH, 1);
    await resolveAndCacheIdentity(ETH, 8453);
    const cache = await getEnsIdentityCache();
    assert.equal(cache[ensIdentityKey(ETH, 1)].name, "onshow.eth");
    assert.equal(cache[ensIdentityKey(ETH, 8453)].name, null);
    assert.equal(cache[ETH], undefined);
    assert.equal(cache[ensIdentityKey(ETH, 0)], undefined);
  } finally {mock.restore();}
});


test("existing account profiles survive absent default EVM records and cached misses", async () => {
  const mock = installResolver();
  try {
    mock.records.delete(2147483648n);
    // Reproduce the preceding release's negative cache entry.
    await resolveAndCacheIdentity(ETH, 0);
    assert.equal((await getEnsIdentityCache())[ensIdentityKey(ETH, 0)].name, null);
    assert.equal(await resolveNameToAddress("onshow.eth"), ETH);
    assert.equal(await resolveAddressToName(ETH), "onshow.eth");
    const batch = await resolveEnsIdentitiesBatch([ETH]);
    assert.equal(batch.get(ETH)?.name, "onshow.eth");
    assert.equal((await resolveAndCacheIdentity(ETH)).name, "onshow.eth");
    const cache = await getEnsIdentityCache();
    assert.equal(ensIdentityKey(ETH), ensIdentityKey(ETH, 1));
    assert.equal(cache[ensIdentityKey(ETH)].name, "onshow.eth");
    // Account compatibility must not reintroduce cross-chain payment labels.
    assert.equal(await resolveAddressToName(ETH, 8453), null);
    assert.equal(await resolveNameToAddress("onshow.eth", 8453), BASE);
    assert.equal(await resolveNameToAddress("onshow.eth", 0), null);
  } finally { mock.restore(); }
});


test("live L2 reverse fallback recovers individual and batch names only with matching forward records", async () => {
  const mock = installResolver(true);
  try {
    assert.equal(await resolveAddressToName(BASE, 8453), "onshow.eth");
    assert.equal(await resolveAddressToName(ETH, 8453), null);
    assert.equal(await resolveAddressToName(BASE, 1), null);
    assert.equal(await resolveAddressToName(BASE, 42161), null); // Registrar coin type mismatch.
    const batch = await resolveEnsIdentitiesBatch([BASE, ETH], new Map(), 8453);
    assert.equal(batch.get(BASE)?.name, "onshow.eth");
    assert.equal(batch.get(ETH)?.name, null);
    mock.records.delete(2147492101n);
    assert.equal(await resolveAddressToName(BASE, 8453), null);
    mock.fail();
    assert.equal(await resolveAddressToName(BASE, 8453), null);
  } finally { mock.restore(); }
});

test("old L2 misses retry while refreshed misses retain their normal cache lifetime", async () => {
  const mock = installResolver(true);
  try {
    const key = ensIdentityKey(BASE, 8453);
    const profileKey = ensIdentityKey(ETH, 1);
    await chrome.storage.local.set({ ensIdentityCache: {
      [key]: { name: null, avatar: null, resolvedAt: Date.now() },
      [profileKey]: { name: "onshow.eth", avatar: null, resolvedAt: Date.now() },
    } });
    const old = await getEnsIdentityCache();
    assert.equal(isCacheValid(old[key]), false);
    assert.equal(isCacheValid(old[profileKey]), true);
    mock.records.delete(2147492101n);
    await resolveAndCacheIdentity(BASE, 8453);
    const refreshed = await getEnsIdentityCache();
    assert.equal(refreshed[key].name, null);
    assert.equal(isCacheValid(refreshed[key]), true);
  } finally { mock.restore(); }
});
