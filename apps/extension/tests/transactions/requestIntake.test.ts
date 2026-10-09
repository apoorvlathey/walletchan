import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { accountExecutionTypedData, safeTransactionTypedData } from "../signatures/accountDomainFixture";
import { INTERNAL_ACCOUNT_TYPED_DATA_ERROR } from "../../src/chrome/eip712Validator";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

type StorageRecord = Record<string, unknown>;

const clone = <T>(value: T): T => structuredClone(value);

function storageArea(storage: StorageRecord) {
  return {
    async get(keys?: string | string[] | StorageRecord | null) {
      if (keys == null) return clone(storage);
      if (typeof keys === "string") return { [keys]: clone(storage[keys]) };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, clone(storage[key])]));
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [
          key,
          clone(storage[key] ?? fallback),
        ]),
      );
    },
    async set(values: StorageRecord) {
      Object.assign(storage, clone(values));
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
    },
    async clear() {
      for (const key of Object.keys(storage)) delete storage[key];
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for request intake");
}

test("request intake persists exact transaction and signature account context", async () => {
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const address = "0x1111111111111111111111111111111111111111";
  const local: StorageRecord = {
    encryptedApiKeyVault: {
      ciphertext: Buffer.alloc(32, 0x22).toString("base64"),
      iv: Buffer.alloc(12, 0x11).toString("base64"),
      salt: "",
    },
    accounts: [
      {
        id: "pk-1",
        type: "privateKey",
        address,
        createdAt: 1,
      },
    ],
  };
  const sync: StorageRecord = { activeAccountId: "pk-1" };
  const session: StorageRecord = {};
  const runtimeMessages: unknown[] = [];
  const popupCreates: unknown[] = [];

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        lastError: undefined,
        getURL(path: string) {
          return `chrome-extension://walletchan/${path}`;
        },
        async sendMessage(message: unknown) {
          runtimeMessages.push(clone(message));
          return null;
        },
      },
      storage: {
        local: storageArea(local),
        sync: storageArea(sync),
        session: storageArea(session),
      },
      action: {
        async setBadgeText() {},
        async setBadgeBackgroundColor() {},
      },
      windows: {
        async getAll() {
          return [];
        },
        async getLastFocused() {
          return { id: 1, left: 0, top: 0, width: 1200, height: 800 };
        },
        async get() {
          return { id: 1, left: 0, top: 0, width: 1200, height: 800 };
        },
        async update() {},
        async create(options: unknown) {
          popupCreates.push(clone(options));
          return { id: popupCreates.length };
        },
      },
      tabs: {
        async query() {
          return [];
        },
      },
    },
  });

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: { port: 0 } }, optimizeDeps: { noDiscovery: true }, resolve: { alias: { "@": path.join(root, "src") } }, plugins: [{
    name: "intake-result-transport",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "./onchainState" && importer?.endsWith("/safe/proposalLifecycle.ts")) return "\0intake-safe-nonce";
      if (source === "../walletConnect/resultBridge" && importer?.endsWith("/transactions/runtime.ts")) return "\0intake-result-transport";
      return null;
    },
    load(id) {
      if (id === "\0intake-safe-nonce") return "export const readSafeDraftNonce = async () => 4n; export const verifySafeOnchainState = async () => { throw new Error('Draft intake must not sign or execute'); };";
      if (id === "\0intake-result-transport") return "export const completeWalletConnectRequestIfNeeded = async () => {};";
      return null;
    },
  }] });
  try {
    const { handleSignatureRequest, handleTransactionRequest } = await server.ssrLoadModule("/src/chrome/transactions/requestIntake.ts");

    handleTransactionRequest(
      {
        type: "transactionRequest",
        tx: {
          chainId: 4326,
          from: address,
          to: "0x2222222222222222222222222222222222222222",
          value: "0x00",
          gas: "0x5208",
        },
        origin: "https://example.test",
        favicon: "https://example.test/favicon.png",
      },
      "tx-1",
      1,
      "https://example.test",
      undefined,
      0,
    );

    await waitFor(
      () => Array.isArray(local.pendingTxRequests) &&
        local.pendingTxRequests.length === 1,
    );
    const pendingTx = (local.pendingTxRequests as Array<Record<string, unknown>>)[0];
    assert.equal(pendingTx.accountId, "pk-1");
    assert.equal(pendingTx.accountAddress, address);
    assert.equal(pendingTx.accountType, "privateKey");
    assert.equal(pendingTx.senderOrigin, "https://example.test");
    assert.equal(pendingTx.requestChainId, 4326);
    assert.equal((pendingTx.tx as Record<string, unknown>).value, "0x0");
    assert.equal((pendingTx.tx as Record<string, unknown>).gas, undefined);

    handleSignatureRequest(
      {
        type: "signatureRequest",
        signature: {
          method: "personal_sign",
          params: ["0x1234", address],
          chainId: 1,
        },
        origin: "https://example.test",
      },
      "sig-1",
      1,
      "https://example.test",
      undefined,
      0,
    );

    await waitFor(
      () => Array.isArray(local.pendingSignatureRequests) &&
        local.pendingSignatureRequests.length === 1,
    );
    const pendingSignature = (
      local.pendingSignatureRequests as Array<Record<string, unknown>>
    )[0];
    assert.equal(pendingSignature.accountId, "pk-1");
    assert.equal(pendingSignature.accountAddress, address);
    assert.equal(pendingSignature.accountType, "privateKey");
    assert.equal(pendingSignature.senderOrigin, "https://example.test");
    assert.equal(pendingSignature.requestChainId, 1);

    await waitFor(() =>
      runtimeMessages.some(
        (message) =>
          (message as { type?: string }).type === "newPendingTxRequest",
      ),
    );
    await waitFor(() =>
      runtimeMessages.some(
        (message) =>
          (message as { type?: string }).type ===
          "newPendingSignatureRequest",
      ),
    );
    await waitFor(() => popupCreates.length >= 2);
    const popupCount = popupCreates.length;
    const messageCount = runtimeMessages.length;
    const wc = await server.ssrLoadModule("/src/chrome/walletConnect/pendingRequests.ts");
    for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
      for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"] as const) {
        for (const target of [address, "0x3333333333333333333333333333333333333333"] as const) {
          local.accounts = [{ id: "pk-1", type, address, createdAt: 1 }, { id: "other", type: "ledger", address: "0x3333333333333333333333333333333333333333", createdAt: 1 }];
          const id = `blocked-${type}-${method}-${target}`;
          const signature = { method, params: [address, JSON.stringify(accountExecutionTypedData(target))], chainId: 1 };
          handleSignatureRequest({ type: "signatureRequest", signature, origin: "WalletChan" }, id, 1, "https://malicious.test");
          await waitFor(() => !!session[`sigResult:${id}`] || !!local[`sigResult:${id}`]);
          const result = (session[`sigResult:${id}`] ?? local[`sigResult:${id}`]) as any;
          assert.equal(result.result.error, INTERNAL_ACCOUNT_TYPED_DATA_ERROR);
          const kit = { getActiveSessions: () => ({ topic: { namespaces: { eip155: { accounts: [`eip155:1:${address}`] } } } }) };
          await assert.rejects(wc.createPendingSignatureRequest(kit as never, { topic: "topic", id: 1 }, method, signature.params, 1, "claim"), { message: INTERNAL_ACCOUNT_TYPED_DATA_ERROR });
        }
      }
    }
    assert.equal((local.pendingSignatureRequests as unknown[]).length, 1);
    assert.equal(popupCreates.length, popupCount);
    assert.equal(runtimeMessages.length, messageCount);

    const wcStorage = await server.ssrLoadModule("/src/chrome/walletConnect/storage.ts");
    const safeAddress = "0x3333333333333333333333333333333333333333";
    let remoteId = 100;
    for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
      for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"] as const) {
        local.accounts = [{ id: "pk-1", type, address, createdAt: 1 }, { id: "safe", type: "safe", address: safeAddress, createdAt: 1 }];
        const id = `safe-owner-${type}-${method}`;
        const signature = { method, params: [address, JSON.stringify(safeTransactionTypedData(safeAddress))], chainId: 1 };
        handleSignatureRequest({ type: "signatureRequest", signature, origin: "https://safe.test" }, id, 1, "https://safe.test");
        await waitFor(() => !!local[`sigResult:${id}`] || (local.pendingSignatureRequests as Array<{ id: string }>).some((pending) => pending.id === id));
        assert.equal(local[`sigResult:${id}`], undefined, `${id}: ${JSON.stringify(local[`sigResult:${id}`])}`);
        const kit = { getActiveSessions: () => ({ topic: { namespaces: { eip155: { accounts: [`eip155:1:${address}`] } } } }) };
        const requestId = remoteId++;
        const claim = await wcStorage.claimWalletConnectRemoteRequest("topic", requestId, method);
        assert.equal(claim.acquired, true);
        await wc.createPendingSignatureRequest(kit as never, { topic: "topic", id: requestId }, method, signature.params, 1, claim.claimId);
        assert.ok((local.pendingSignatureRequests as Array<any>).some((pending) => pending.walletConnect?.requestId === requestId && pending.accountType === type));
      }
    }
    local.accounts = [{ id: "safe-1", type: "safe", address, createdAt: 1 }];
    sync.activeAccountId = "safe-1";
    local.pendingSignatureRequests = [];
    const beforeSafePopup = popupCreates.length;
    handleSignatureRequest({ type: "signatureRequest", signature: { method: "personal_sign", params: ["0x1234", address], chainId: 1 }, origin: "https://dapp.test" }, "safe-review", 1, "https://dapp.test");
    await waitFor(() => (local.pendingSignatureRequests as any[]).some((pending) => pending.id === "safe-review"));
    await waitFor(() => popupCreates.length > beforeSafePopup);
    const safeReview = (local.pendingSignatureRequests as any[]).find((pending) => pending.id === "safe-review");
    assert.equal(safeReview.accountType, "safe");
    assert.equal(safeReview.accountId, "safe-1");
    assert.equal(local["sigResult:safe-review"], undefined);
    assert.equal(session["sigResult:safe-review"], undefined);
    const policy = await server.ssrLoadModule("/src/chrome/signatures/confirmationPolicy.ts");
    const confirmation = await policy.prepareSignatureConfirmation("safe-review");
    assert.equal(confirmation.ok, false, "review-only Safe request must never reach a direct signer");
    local.safeAccounts = { version: 1, records: [{ version: 1, accountId: "safe-1", address, importedBy: "manual", chains: { "1": {
      chainId: 1, verifiedAtBlock: "12", configEpoch: `0x${"12".repeat(32)}`,
      singleton: "0x3333333333333333333333333333333333333333", version: "1.4.1",
      owners: ["0x4444444444444444444444444444444444444444"], contractOwners: [], threshold: 1, nonce: "4", modules: [],
      guard: "0x0000000000000000000000000000000000000000", fallbackHandler: "0x0000000000000000000000000000000000000000",
      transactionService: "supported", capability: "observe",
    } } }] };
    const beforeSafeTransactionPopup = popupCreates.length;
    handleTransactionRequest({ type: "transactionRequest", tx: { chainId: 1, from: address, to: "0x2222222222222222222222222222222222222222", value: "0", data: "0x" }, origin: "https://dapp.test" }, "safe-tx-review", 1, "https://dapp.test");
    await waitFor(() => runtimeMessages.some((message: any) => message.type === "newSafeProposalRequest"));
    await waitFor(() => popupCreates.length > beforeSafeTransactionPopup);
    assert.equal(local["txResult:safe-tx-review"], undefined);
    assert.equal(session["txResult:safe-tx-review"], undefined);

  } finally {
    await server.close();
    if (originalChrome) {
      Object.defineProperty(globalThis, "chrome", originalChrome);
    } else {
      delete (globalThis as { chrome?: unknown }).chrome;
    }
  }
});
