import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "vite";

function deferred() {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve: () => resolve() };
}
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw Error("Timed out waiting for signing boundary");
    await new Promise((r) => setTimeout(r, 1));
  }
}

test("Ledger force inclusion commits only after the parent approval on OP Stack and Nitro", async (t) => {
  const local = privateKeyToAccount(`0x${"11".repeat(32)}`);
  const account = { id: "ledger", type: "ledger", address: local.address, deviceId: "device", hdPath: "path" };
  const hash = `0x${"ab".repeat(32)}`;
  const state: any = { account, gate: deferred(), history: [], events: [], pending: true,
    processing: new Set(), active: new Map(), reject: false, authorized: true, uncertain: false, failAfterSend: false,
    signer: null, rpc: null };
  const makeSigner = () => ({
    account: local,
    assertAvailable: async () => { if (!state.authorized) throw Error("Authorization revoked"); },
    signChild: async () => { state.events.push("child-sign"); return "0x04aa"; },
    broadcast: async (_client: unknown, request: any, options: any) => {
      state.parent = request; state.events.push("parent-prompt"); await state.gate.promise;
      if (state.reject) throw Error("Device rejected");
      await options.beforeBroadcast({ transactionHash: hash, serializedTransaction: "0x1234" });
      assert.equal(state.pending, false);
      assert.equal(state.history.at(-1).forceInclusionMeta.l1TxHash, hash);
      state.events.push("send");
      return { txHash: hash, broadcastUncertain: state.uncertain };
    },
  });
  state.rpc = {
    getTransactionCount: async () => 4,
    readContract: async () => 117964n,
    waitForTransactionReceipt: async () => { throw Error("Receipt pending"); },
  };
  Object.assign(globalThis, { __fiLifecycle: state });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: { port: 25000 + process.pid % 5000 } },
    optimizeDeps: { noDiscovery: true }, resolve: { alias: { "@": path.join(root, "src") } },
    plugins: [{ name: "fi-lifecycle-boundaries", enforce: "pre",
      resolveId(source, importer) {
        const file = importer?.split("?", 1)[0] ?? "";
        if (file.endsWith("/forceInclusion/singleLocal.ts") && source === "viem") return "\0fi-viem";
        if (file.endsWith("/arbitrumForceInclusion/single.ts") && source === "./preparation") return "\0fi-preparation";
        if (!/\/(forceInclusion|arbitrumForceInclusion|ledger)\//.test(file)) return null;
        return ({
          "../forceInclusion/rawSigner": "\0fi-signer", "../accountStorage": "\0fi-account",
          "../requests/pendingTxStorage": "\0fi-pending", "../requests/pendingRequestLifecycle": "\0fi-auth",
          "../requests/pendingRequestResolution": "\0fi-lease", "../transactions/runtime": "\0fi-runtime",
          "../txHistoryStorage": "\0fi-history", "../clearSignedMetaSnapshot": "\0fi-clear",
          "../transactions/notification": "\0fi-notify", "../forceInclusion/l1Client": "\0fi-l1",
          "./l1Client": "\0fi-l1", "../transactions/rpcConfig": "\0fi-rpc",
          "../forceInclusion/receiptPoller": "\0fi-polls", "./offscreenBridge": "\0fi-offscreen",
        } as Record<string, string>)[source];
      },
      load(id) {
        const s = "const s = globalThis.__fiLifecycle;";
        if (id === "\0fi-viem") return `export { createWalletClient } from 'viem'; export const createPublicClient = () => ({ estimateGas: async () => 21000n });`;
        if (id === "\0fi-signer") return s + "export const createRawForceInclusionSigner = async () => s.signer; export const localForceInclusionSigner = () => { throw Error('Unexpected key'); };";
        if (id === "\0fi-account") return s + "export const getAccountById = async () => s.account;";
        if (id === "\0fi-pending") return s + "export const removePendingTxRequest = async () => { s.pending = false; s.events.push('remove'); };";
        if (id === "\0fi-auth") return s + "export const enforcePendingRequestAuthorizationAtConfirmation = async () => ({ authorized: s.authorized, error: 'Authorization revoked' }); export const capturePendingRequestAuthorizationCommitSnapshot = async () => { const epoch = s.revocationEpoch; return { isCurrent: () => epoch === s.revocationEpoch }; };";
        if (id === "\0fi-lease") return s + "export const guardPendingRequestEffectLease = lease => ({ beginEffect: () => s.events.push('effect'), settleEffect: () => s.events.push('settle'), releaseIfSafe: () => lease?.release() });";
        if (id === "\0fi-runtime") return s + "export const activeAbortControllers = s.active; export const processingTxIds = s.processing; export const writeResultToStorage = async (id, value) => s.events.push(value.success ? 'result-success' : 'result-failed');";
        if (id === "\0fi-history") return s + `export const addTxToHistory = async row => { s.history.push(row); s.events.push('history'); };
          export const updateTxInHistory = async (id, patch) => { if (s.failAfterSend && s.events.includes('send')) throw Error('Disk failed'); Object.assign(s.history.find(row => row.id === id), patch);
            if (s.revokeDuringHistory && patch.forceInclusionMeta?.l1TxHash) { s.revocationEpoch++; s.revokeDuringHistory = false; }
          };`;
        if (id === "\0fi-clear") return "export const attachClearSignedMetaToHistory = async () => {};";
        if (id === "\0fi-notify") return "export const showNotification = async () => {};";
        if (id === "\0fi-rpc") return "export const getRpcUrl = async () => 'https://rpc.example';";
        if (id === "\0fi-l1") return s + `export { mainnet as ignored } from 'viem/chains';
          export const getL1Chain = id => ({ id, name: 'parent', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.example'] } } });
          export const getL1RpcUrl = async () => 'https://rpc.example'; export const createL1PublicClient = () => s.rpc;
          export const L1_RPC_TIMEOUT = 1; export const L1_RECEIPT_TIMEOUT = 1; export const writeForceInclusionProgress = async () => {};`;
        if (id === "\0fi-polls") return "export const startReceiptPolling = () => {};";
        if (id === "\0fi-offscreen") return s + "export const cancelLedgerOperation = async () => { s.events.push('cancel'); };";
        if (id === "\0fi-preparation") return `export const assertDelayedMessageSize = () => {};
          export const prepareSignedArbitrumMessage = async (tx, info, signer) => ({ messageData: await signer.signChild(tx), childHash: '0x${"cd".repeat(32)}' });`;
      },
    }],
  });
  try {
    const { processLedgerForceInclusion } = await server.ssrLoadModule("/src/chrome/ledger/forceInclusion.ts");
    for (const chainId of [8453, 4663, 46630]) for (const scenario of ["success", "reject", "revoked", "revoked-during-history", "uncertain", "storage-error"]) {
      await t.test(`${chainId}: ${scenario}`, async () => {
        state.history = []; state.events = []; state.pending = true; state.gate = deferred();
        state.revocationEpoch = 0; state.revokeDuringHistory = scenario === "revoked-during-history";
        state.authorized = true; state.reject = scenario === "reject"; state.uncertain = scenario === "uncertain";
        state.failAfterSend = scenario === "storage-error"; state.signer = makeSigner();
        const pending = { id: "tx", tx: { chainId, from: account.address, to: account.address, data: "0x", value: "0x0" }, timestamp: 1, chainName: "chain", accountId: account.id };
        const resultPromise = processLedgerForceInclusion({ txId: "tx", pending, account, effectLease: { release: () => state.events.push("release") } });
        await until(() => state.events.includes("parent-prompt"));
        assert.equal(state.pending, true); assert.equal(state.history.length, 0);
        assert.equal(state.events.includes("child-sign"), chainId !== 8453);
        if (scenario === "revoked") state.authorized = false;
        state.gate.resolve(); const result = await resultPromise;
        if (scenario === "reject" || scenario === "revoked") {
          assert.equal(result.success, false); assert.equal(state.pending, true);
          assert.equal(state.history.length, 0); assert.equal(state.events.includes("send"), false);
        } else if (scenario === "revoked-during-history") {
          assert.equal(result.success, false);
          assert.match(result.error, /authorization changed before broadcast/);
          assert.equal(state.events.includes("send"), false);
          assert.equal(state.events.includes("effect"), false);
          assert.equal(state.history[0].status, "failed");
        } else {
          assert.equal(result.success, true); assert.equal(state.pending, false);
          assert.equal(state.history[0].accountType, "ledger");
          assert.equal(state.history[0].forceInclusionMeta.l1ChainId, chainId === 46630 ? 11155111 : 1);
          assert.equal(state.history[0].forceInclusionMeta.l1TxHash, hash);
          assert.equal(state.parent.value, 0n);
          assert.equal(state.events.filter((e: string) => e === "send").length, 1);
          assert.equal(state.events.includes("result-failed"), false);
        }
        assert.equal(state.active.size, 0);
        // Let the detached receipt continuation complete before resetting mocks.
        await new Promise((r) => setTimeout(r, 5));
      });
    }
  } finally { await server.close(); delete (globalThis as any).__fiLifecycle; }
});
