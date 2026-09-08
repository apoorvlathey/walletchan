import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeAbiParameters, encodeEventTopics, keccak256, decodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "vite";
import { ARBITRUM_SEQUENCER_INBOX_ABI, BRIDGE_MESSAGE_DELIVERED_ABI } from "../../src/chrome/arbitrumForceInclusion/contracts";

test("the later force action dispatches raw signers and revalidates after approval", async (t) => {
  const local = privateKeyToAccount(`0x${"11".repeat(32)}`);
  const inbox = "0xF2939afA86F6f933A3CE17fCAB007907B6b0B7a4";
  const bridge = "0x96295BDad104eaD97cC08797b3dC68efF59CcF30";
  const sequencerInbox = "0xA0D9dB3DC9791D54b5183C1C1866eFe1eCA7D414";
  const rawChild = "0x1234";
  const messageData = "0x041234";
  const meta = { protocol: "arbitrum", l1TxHash: `0x${"aa".repeat(32)}`, l2TxHash: keccak256(rawChild), l1ChainId: 11155111, l2ChainId: 46630,
    inbox, bridge, sequencerInbox, messageIndex: "0", messageBlockNumber: "100", messageBlockHash: `0x${"bb".repeat(32)}`,
    messageTimestamp: "999", kind: 3, sender: local.address, baseFeeL1: "1", messageDataHash: keccak256(messageData) };
  const receipt = { status: "success", blockNumber: 100n, blockHash: meta.messageBlockHash, logs: [
    { address: bridge, topics: encodeEventTopics({ abi: BRIDGE_MESSAGE_DELIVERED_ABI, eventName: "MessageDelivered", args: { messageIndex: 0n, beforeInboxAcc: `0x${"00".repeat(32)}` } }),
      data: encodeAbiParameters([{ type: "address" }, { type: "uint8" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint64" }], [inbox, 3, local.address, meta.messageDataHash, 1n, 999n]) },
    { address: inbox, topics: [keccak256(new TextEncoder().encode("InboxMessageDelivered(uint256,bytes)")), `0x${"00".repeat(32)}`], data: encodeAbiParameters([{ type: "bytes" }], [messageData]) },
  ] };
  const state: any = { account: null, tx: null, read: 0n, block: 102n, receipt, sends: 0, factories: [], duringPrompt: async () => {}, data: null };
  const forceHash = `0x${"cc".repeat(32)}`;
  state.signer = { account: local, assertAvailable: async () => {}, broadcast: async (_c: unknown, request: any, options: any) => {
    state.data = request.data; assert.equal(options.chainId, 11155111);
    await state.duringPrompt(); await options.beforeBroadcast({ transactionHash: forceHash });
    state.sends++; return { txHash: forceHash, broadcastUncertain: true };
  } };
  state.rpc = { getTransactionReceipt: async () => state.receipt, getBlockNumber: async () => state.block,
    readContract: async ({ functionName }: any) => functionName === "totalDelayedMessagesRead" ? state.read : 101n,
    estimateGas: async () => 50000n };
  Object.assign(globalThis, { __forceAction: state });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: { port: 31000 + process.pid % 5000 } }, optimizeDeps: { noDiscovery: true },
    resolve: { alias: { "@": path.join(root, "src") } }, plugins: [{ name: "force-action-boundaries", enforce: "pre",
      resolveId(source, importer) {
        if (!importer?.endsWith("/arbitrumForceInclusion/status.ts")) return null;
        return ({ "../accountStorage": "\0action-account", "../forceInclusion/rawSigner": "\0action-signer", "../txHistoryStorage": "\0action-history",
          "../forceInclusion/l1Client": "\0action-client", "../forceInclusion/receiptPoller": "\0action-poll" } as Record<string, string>)[source];
      },
      load(id) {
        const s = "const s = globalThis.__forceAction;";
        if (id === "\0action-account") return s + "export const getAccountById = async () => s.account;";
        if (id === "\0action-signer") return s + "export const createRawForceInclusionSigner = async ({ account }) => { s.factories.push(account.type); return s.signer; };";
        if (id === "\0action-history") return s + "export const getTxById = async () => s.tx; export const updateTxInHistory = async (id, patch) => Object.assign(s.tx, patch);";
        if (id === "\0action-client") return s + "export { sepolia as parent } from 'viem/chains'; import { sepolia } from 'viem/chains'; export const getL1Chain = () => sepolia; export const getL1RpcUrl = async () => 'https://rpc.example'; export const createL1PublicClient = () => s.rpc; export const L1_RPC_TIMEOUT = 1;";
        if (id === "\0action-poll") return "export const startReceiptPolling = () => {};";
      },
    }] });
  const reset = (type: string) => {
    state.account = { id: "account", type, address: local.address };
    state.tx = { id: "tx", accountId: "account", status: "pending", forceInclusionMeta: { ...meta } };
    state.read = 0n; state.block = 102n; state.receipt = receipt; state.sends = 0; state.factories = []; state.duringPrompt = async () => {};
  };
  try {
    const { submitArbitrumForceInclusion } = await server.ssrLoadModule("/src/chrome/arbitrumForceInclusion/status.ts");
    for (const type of ["privateKey", "seedPhrase", "ledger"]) await t.test(`${type} uses its raw signer and tracks uncertain force submission`, async () => {
      reset(type); const result = await submitArbitrumForceInclusion("tx");
      assert.equal(result.success, true); assert.deepEqual(state.factories, [type]); assert.equal(state.sends, 1);
      assert.equal(state.tx.forceInclusionMeta.forceTransactionHash, forceHash);
      const call = decodeFunctionData({ abi: ARBITRUM_SEQUENCER_INBOX_ABI, data: state.data });
      assert.equal(call.functionName, "forceInclusion"); assert.equal(call.args?.[0], 1n);
    });
    for (const type of ["bankr", "safe", "impersonator"]) await t.test(`${type} never reaches a raw signer`, async () => {
      reset(type); assert.equal((await submitArbitrumForceInclusion("tx")).success, false);
      assert.equal(state.factories.length, 0); assert.equal(state.sends, 0);
    });
    for (const scenario of ["consumed", "reorg", "deadline"]) await t.test(`${scenario} during Ledger approval blocks the force call`, async () => {
      reset("ledger"); state.duringPrompt = async () => {
        if (scenario === "consumed") state.read = 1n;
        if (scenario === "deadline") state.block = 101n;
        if (scenario === "reorg") state.receipt = { ...receipt, blockHash: `0x${"dd".repeat(32)}` };
      };
      assert.equal((await submitArbitrumForceInclusion("tx")).success, false); assert.equal(state.sends, 0);
    });
  } finally { await server.close(); delete (globalThis as any).__forceAction; }
});
