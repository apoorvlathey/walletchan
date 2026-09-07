import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("recovery skips completed records and isolates failures across all wallet types", async () => {
  const state = { history: [] as any[], updates: [] as any[], reads: 0, bundles: 0 };
  Object.assign(globalThis, { __arbRecovery: state });
  const server = await createServer({
    configFile: false, server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [{
      name: "recovery-boundaries", enforce: "pre",
      resolveId(source, importer) {
        if (!importer?.endsWith("/recovery.ts")) return null;
        return ({
          "../txHistoryStorage": "\0history",
          "../forceInclusion/l1Client": "\0client", "./l1Client": "\0client",
          "../forceInclusion/receiptPoller": "\0polls",
          "./bundleRecovery": "\0bundles", "./singleOutcome": "\0outcome",
        } as Record<string, string>)[source] ?? null;
      },
      load(id) {
        const pre = "const s = globalThis.__arbRecovery;";
        if (id === "\0history") return pre + `export const getTxHistory = async () => s.history;
          export const updateTxInHistory = async (id, patch) => s.updates.push({ id, patch });`;
        if (id === "\0client") return pre + `export const getL1RpcUrl = async () => '';
          export const createL1PublicClient = () => ({ getTransactionReceipt: async () => {
            s.reads++; return { status: 'success', gasUsed: 1n, effectiveGasPrice: 1n, logs: [] };
          } });`;
        if (id === "\0polls") return `export const startReceiptPolling = () => { throw new Error('Unexpected poll'); };`;
        if (id === "\0bundles") return pre + `export const recoverStuckForceInclusionBundles = async () => { s.bundles++; };`;
        if (id === "\0outcome") return `export const extractL2Hash = () => null;`;
      },
    }],
  });
  const warnings: any[] = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args); };
  try {
    const { recoverStuckForceInclusionTxs } = await server.ssrLoadModule("/src/chrome/forceInclusion/recovery.ts");
    for (const accountType of ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"]) {
      const entry = (id: string, status: string, gasData?: unknown) => ({
        id, status, accountType, gasData, tx: { from: "0x1234567890123456789012345678901234567890" },
        forceInclusionMeta: { protocol: "arbitrum", l1TxHash: `0x${"11".repeat(32)}`,
          l2TxHash: `0x${"22".repeat(32)}`, l1ChainId: 1, l2ChainId: 42161,
          bridge: "0x1234567890123456789012345678901234567890",
          inbox: "0x1234567890123456789012345678901234567890",
          sequencerInbox: "0x1234567890123456789012345678901234567890" },
      });
      state.reads = 0; state.updates = []; warnings.length = 0;
      state.history = [entry("complete", "success", { feeSource: "forceInclusionL1" })];
      await recoverStuckForceInclusionTxs();
      assert.equal(state.reads, 0);
      assert.deepEqual(state.updates, []);
      state.history = [entry("invalid", "pending"), entry("backfill", "success")];
      await recoverStuckForceInclusionTxs();
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0][1].txId, "invalid");
      assert.equal(state.updates.length, 1);
      assert.equal(state.updates[0].id, "backfill");
      assert.deepEqual(Object.keys(state.updates[0].patch), ["gasData"]);
    }
    assert.equal(state.bundles, 12);
  } finally {
    console.warn = originalWarn;
    await server.close();
    delete (globalThis as any).__arbRecovery;
  }
});
