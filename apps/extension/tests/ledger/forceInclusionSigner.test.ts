import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTransaction, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "vite";

// Device boundary only is faked: real serialization, recovered-signer checks,
// raw adapter, final lock boundary and ambiguity handling are exercised.
test("Ledger force-inclusion raw signing preserves device and session authority", async (t) => {
  const key = privateKeyToAccount(`0x${"11".repeat(32)}`);
  const other = privateKeyToAccount(`0x${"22".repeat(32)}`);
  const account = { id: "ledger", type: "ledger", address: key.address, deviceId: "device", hdPath: "m/44'/60'/0'/0/0" };
  const state = {
    current: { ...account }, epoch: "epoch", passwordType: "master" as string | null,
    locked: false, deviceCalls: [] as any[], sends: [] as any[], keyReads: 0,
    duringDevice: async () => {}, reject: false, wrongSigner: false,
    sign: async (unsignedTx: `0x${string}`) => {
      const transaction = parseTransaction(unsignedTx);
      const signed = parseTransaction(await (state.wrongSigner ? other : key).signTransaction(transaction as never));
      return { r: signed.r, s: signed.s, v: Number(signed.yParity) };
    },
  };
  Object.assign(globalThis, { __fiSigner: state });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true }, resolve: { alias: { "@": path.join(root, "src") } },
    plugins: [{ name: "fi-signer-boundaries", enforce: "pre",
      resolveId(source, importer) {
        const file = importer?.split("?", 1)[0] ?? "";
        if (file.endsWith("/ledger/signing.ts") && source === "./offscreenBridge") return "\0fi-device";
        if (file.endsWith("/forceInclusion/rawSigner.ts")) return ({
          "../accountStorage": "\0fi-account", "../accounts/localKeyResolver": "\0fi-key",
          "../authTransition": "\0fi-epoch", "../sessionCache": "\0fi-session",
          "../ledger/session": "\0fi-unlock", "../storageLock": "\0fi-lock",
        } as Record<string, string>)[source];
      },
      load(id) {
        const s = "const s = globalThis.__fiSigner;";
        if (id === "\0fi-account") return s + "export const getAccountById = async () => s.current;";
        if (id === "\0fi-key") return s + "export const getLocalPrivateKeyForAccount = async () => { s.keyReads++; throw Error('No hardware key'); };";
        if (id === "\0fi-epoch") return s + "export const getAuthCeremonyEpoch = () => s.epoch; export const isCurrentAuthCeremonyEpoch = e => e === s.epoch;";
        if (id === "\0fi-session") return s + "export const getPasswordType = () => s.passwordType;";
        if (id === "\0fi-unlock") return s + "export const ensureLedgerSigningSession = async () => { if (!s.passwordType) throw Error('Locked'); };";
        if (id === "\0fi-lock") return s + "export const WALLET_SECRET_OPERATION_LOCK_KEY = 'wallet'; export const withStorageLock = async (k, f) => { s.locked = true; try { return await f(); } finally { s.locked = false; } };";
        if (id === "\0fi-device") return s + `
          export const signLedgerTransaction = async input => {
            if (s.locked) throw Error('Wallet lock held during device prompt');
            s.deviceCalls.push(input); await s.duringDevice();
            if (s.reject) throw Error('Device rejected');
            return s.sign(input.unsignedTx);
          };
          export const signLedgerMessage = async () => { throw Error('unexpected'); };
          export const signLedgerTypedData = signLedgerMessage;`;
      },
    }],
  });
  try {
    const { createRawForceInclusionSigner } = await server.ssrLoadModule("/src/chrome/forceInclusion/rawSigner.ts");
    const { signPreparedLedgerTransaction } = await server.ssrLoadModule("/src/chrome/ledger/signing.ts");
    const transaction = { chainId: 4663, type: "eip1559", nonce: 7, to: key.address, value: 1n, gas: 21000n, maxFeePerGas: 10n, maxPriorityFeePerGas: 1n };
    const reset = () => {
      state.current = { ...account }; state.epoch = "epoch"; state.passwordType = "master";
      state.deviceCalls = []; state.sends = []; state.reject = false; state.wrongSigner = false; state.duringDevice = async () => {};
    };
    for (const passwordType of ["master", "agent"]) await t.test(`${passwordType} signs a child without sending, then broadcasts exact parent bytes`, async () => {
      reset(); state.passwordType = passwordType;
      const signer = await createRawForceInclusionSigner({ account, opId: "request" });
      const child = await signer.signChild(transaction);
      assert.equal(parseTransaction(child).chainId, 4663);
      assert.equal(state.sends.length, 0);
      let checked = false;
      const parent = { ...transaction, chainId: 1, nonce: 9, data: child, value: 0n };
      const client = { prepareTransactionRequest: async () => parent, signTransaction: signer.account.signTransaction,
        request: async ({ params }: any) => { assert.equal(state.locked, true); assert.equal(checked, true); state.sends.push(params[0]); return keccak256(params[0]); } };
      const result = await signer.broadcast(client, parent, { chainId: 1, supportsSyncSend: false, beforeBroadcast: async () => { checked = true; } });
      assert.equal(parseTransaction(state.sends[0]).chainId, 1);
      assert.equal(parseTransaction(state.sends[0]).data, child);
      assert.equal(result.txHash, keccak256(state.sends[0]));
      assert.equal(state.deviceCalls.length, 2);
      assert.equal(state.keyReads, 0);
    });
    for (const [name, mutate] of [
      ["lock", () => { state.passwordType = null; }],
      ["new session", () => { state.epoch = "changed"; }],
      ["removed account", () => { state.current = null as any; }],
      ["changed device", () => { state.current.deviceId = "other"; }],
      ["changed derivation", () => { state.current.hdPath = "m/44'/60'/1'/0/0"; }],
    ] as const) await t.test(`${name} during a device prompt blocks signed-byte release`, async () => {
      reset(); const signer = await createRawForceInclusionSigner({ account, opId: "request" });
      state.duringDevice = async () => mutate();
      await assert.rejects(signer.signChild(transaction), /authorization changed|no longer available/);
      assert.equal(state.sends.length, 0);
    });
    await t.test("cancellation, wrong recovered signer and device rejection fail closed", async () => {
      reset(); const controller = new AbortController();
      const signer = await createRawForceInclusionSigner({ account, opId: "request", signal: controller.signal });
      state.duringDevice = async () => controller.abort();
      await assert.rejects(signer.signChild(transaction), /authorization changed/);
      reset(); const fresh = await createRawForceInclusionSigner({ account, opId: "request" });
      state.wrongSigner = true; await assert.rejects(fresh.signChild(transaction), /different account/);
      state.wrongSigner = false; state.reject = true; await assert.rejects(fresh.signChild(transaction), /Device rejected/);
    });
    await t.test("locked wallets and unsupported transaction types never prompt", async () => {
      reset(); state.passwordType = null;
      await assert.rejects(createRawForceInclusionSigner({ account, opId: "request" }), /Locked/);
      await assert.rejects(signPreparedLedgerTransaction({ account, opId: "request", transaction: { ...transaction, type: "eip7702" } }), /Unsupported/);
      await assert.rejects(signPreparedLedgerTransaction({ account, opId: "request", transaction: { ...transaction, chainId: undefined } }), /chain ID/);
      assert.equal(state.deviceCalls.length, 0);
    });
  } finally { await server.close(); delete (globalThis as any).__fiSigner; }
});
