import assert from "node:assert/strict";
import { accountExecutionTypedData, safeTransactionTypedData } from "./accountDomainFixture";
import { INTERNAL_ACCOUNT_TYPED_DATA_ERROR } from "../../src/chrome/eip712Validator";
import { Buffer } from "node:buffer";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

type StorageRecord = Record<string, unknown>;
type SigningHook = {
  local: (...args: unknown[]) => Promise<string>;
  bankr: (...args: unknown[]) => Promise<{ signature: string }>;
  ledger: (...args: unknown[]) => Promise<string>;
  ledgerSession: () => Promise<void>;
  privateKey: string | null;
  apiKey: string | null;
};

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

test("confirmation preserves all wallet authorities and final release races", async (t) => {
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const local: StorageRecord = {
    encryptedApiKeyVault: {
      ciphertext: Buffer.alloc(32, 0x22).toString("base64"),
      iv: Buffer.alloc(12, 0x11).toString("base64"),
      salt: "",
    },
  };
  const sync: StorageRecord = { autoLockTimeout: 60_000 };
  const session: StorageRecord = {};
  let viteServer: ViteDevServer | null = null;

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        lastError: undefined,
        async sendMessage() {},
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
    },
  });

  const hooks: SigningHook = {
    async local() {
      return `0x${"aa".repeat(65)}`;
    },
    async bankr() {
      return { signature: `0x${"bb".repeat(65)}` };
    },
    privateKey: null,
    apiKey: null,
    ledger: async () => { throw new Error("Ledger device must not run"); },
    ledgerSession: async () => { throw new Error("Ledger session must not run"); },
  };
  Object.assign(globalThis, { __walletchanSignatureTestHooks: hooks });

  try {
    const extensionRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    viteServer = await createServer({
      root: extensionRoot,
      configFile: false,
      server: {
        middlewareMode: true,
        hmr: { port: 20_000 + (process.pid % 10_000) },
        watch: { ignored: ["**/build/**", "**/build-firefox/**"] },
      },
      optimizeDeps: { noDiscovery: true },
      resolve: { alias: { "@": path.join(extensionRoot, "src") } },
      plugins: [
        {
          name: "signature-confirmation-signers",
          enforce: "pre",
          resolveId(source, importer) {
            if (importer?.split("?", 1)[0].endsWith("/chrome/ledger/signatureConfirmation.ts")) {
              if (source === "./session") return "\0signature-ledger-session";
              if (source === "./signing") return "\0signature-ledger-signing";
            }
            if (
              !importer
                ?.split("?", 1)[0]
                .endsWith("/chrome/signatures/confirmationHandlers.ts")
            ) return null;
            return ({
              "../localSigner": "\0signature-confirmation-local-signer",
              "../bankr/signing": "\0signature-confirmation-bankr-signer",
              "../sessionCache": "\0signature-confirmation-session",
            } as Record<string, string>)[source] ?? null;
          },
          load(id) {
            if (id === "\0signature-ledger-session") return `export const ensureLedgerSigningSession = (...args) => globalThis.__walletchanSignatureTestHooks.ledgerSession(...args);`;
            if (id === "\0signature-ledger-signing") return `export const signLedgerSignatureRequest = (...args) => globalThis.__walletchanSignatureTestHooks.ledger(...args);`;
            if (id === "\0signature-confirmation-local-signer") {
              return `export const handleSignatureRequest = (...args) => globalThis.__walletchanSignatureTestHooks.local(...args);`;
            }
            if (id === "\0signature-confirmation-bankr-signer") {
              return `export const signMessageViaApi = (...args) => globalThis.__walletchanSignatureTestHooks.bankr(...args);`;
            }
            if (id === "\0signature-confirmation-session") {
              return `
                export const getAutoLockTimeout = async () => 60000;
                export const getCachedApiKey = () => globalThis.__walletchanSignatureTestHooks.apiKey;
                export const getCachedPassword = () => "test-password";
                export const getCachedVaultKey = () => null;
                export const getPrivateKeyFromCache = () => globalThis.__walletchanSignatureTestHooks.privateKey;
                export const setCachedApiKey = (value) => { globalThis.__walletchanSignatureTestHooks.apiKey = value; };
                export const setCachedVault = () => {};
                export const tryRestoreSession = async () => false;
              `;
            }
            return null;
          },
        },
      ],
    });

    const handlers = await viteServer.ssrLoadModule(
      "/src/chrome/signatures/confirmationHandlers.ts",
    );
    const ledgerHandlers = await viteServer.ssrLoadModule("/src/chrome/ledger/signatureConfirmation.ts");
    const pendingStorage = await viteServer.ssrLoadModule(
      "/src/chrome/requests/pendingSignatureStorage.ts",
    );
    const confirmationPolicy = await viteServer.ssrLoadModule(
      "/src/chrome/signatures/confirmationPolicy.ts",
    );
    const pinnedRequest = await viteServer.ssrLoadModule(
      "/src/chrome/requests/pinnedRequest.ts",
    );
    const address = "0x1111111111111111111111111111111111111111";
    const privateKey = `0x${"01".repeat(32)}`;

    const reset = () => {
      local.pendingSignatureRequests = [];
      hooks.local = async () => `0x${"aa".repeat(65)}`;
      hooks.bankr = async () => ({ signature: `0x${"bb".repeat(65)}` });
      hooks.privateKey = null;
      hooks.apiKey = null;
      hooks.ledger = async () => { throw new Error("Ledger device must not run"); };
      hooks.ledgerSession = async () => { throw new Error("Ledger session must not run"); };
    };

    const queue = async (
      type: "bankr" | "privateKey" | "seedPhrase" | "ledger" | "impersonator",
      id: string,
      options: {
        signature?: {
          method:
            | "personal_sign"
            | "eth_sign"
            | "eth_signTypedData"
            | "eth_signTypedData_v3"
            | "eth_signTypedData_v4";
          params: unknown[];
          chainId: number;
        };
        origin?: string;
        senderOrigin?: string;
      } = {},
    ) => {
      const account = {
        id: `${type}-account`,
        type,
        address,
        createdAt: 1,
        ...(type === "seedPhrase"
          ? { seedGroupId: "seed-group", derivationIndex: 0 }
          : {}),
      };
      local.accounts = [account];
      const pending = pinnedRequest.pinnedSignatureRequest(account, {
        id,
        signature: options.signature ?? {
          method: "personal_sign",
          params: ["0x1234", address],
          chainId: 1,
        },
        origin: options.origin ?? "WalletChan",
        ...(options.senderOrigin ? { senderOrigin: options.senderOrigin } : {}),
        favicon: null,
        chainName: "Ethereum",
        timestamp: Date.now(),
        trustedInternal: true,
      });
      await pendingStorage.savePendingSignatureRequest(pending);
      return { account, pending };
    };

    for (const [type, authority] of [
      ["privateKey", "master"],
      ["seedPhrase", "agent"],
      ["bankr", "master"],
    ] as const) {
      await t.test(`aged ${type} signing remains available to ${authority}`, async () => {
        reset();
        await queue(type, `${type}-success`);
        (local.pendingSignatureRequests as Array<{ timestamp: number }>)[0]
          .timestamp = Date.now() - 24 * 60 * 60 * 1000;
        if (type === "bankr") {
          hooks.apiKey = "bankr-api-key";
        } else {
          hooks.privateKey = privateKey;
        }

        const preflight = await confirmationPolicy.prepareSignatureConfirmation(
          `${type}-success`,
        );
        assert.equal(preflight.ok, true, JSON.stringify(preflight));

        const result = type === "bankr"
          ? await handlers.handleConfirmSignatureRequestBankr(
              `${type}-success`,
              "master-password",
            )
          : await handlers.handleConfirmSignatureRequest(
              `${type}-success`,
              "master-password",
            );

        assert.equal(result.success, true, JSON.stringify(result));
        assert.match(result.signature, /^0x[0-9a-f]+$/);
        assert.equal(
          await pendingStorage.getPendingSignatureRequestById(
            `${type}-success`,
          ),
          null,
        );
      });
    }

    for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
      for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"] as const) {
        await t.test(`${type} blocks already-pending ${method} execution signatures before signing`, async () => {
          reset();
          const id = `blocked-${type}-${method}`;
          await queue(type, id, { signature: { method, params: [address, accountExecutionTypedData(address)], chainId: 1 }, origin: "WalletChan" });
          // Even a forged internal-looking label and SIWE override cannot bypass this policy.
          hooks.local = async () => { assert.fail("local signer must not run"); };
          hooks.bankr = async () => { assert.fail("Bankr API must not run"); };
          const result = type === "ledger"
            ? await ledgerHandlers.handleConfirmLedgerSignatureRequest(id, "agent-password", undefined, true)
            : type === "bankr"
              ? await handlers.handleConfirmSignatureRequestBankr(id, "agent-password", true)
              : await handlers.handleConfirmSignatureRequest(id, "agent-password", undefined, true);
          assert.equal(result.success, false);
          assert.equal(result.error, INTERNAL_ACCOUNT_TYPED_DATA_ERROR);
          assert.equal(await pendingStorage.getPendingSignatureRequestById(id), null);
        });
      }
    }

    await t.test("ordinary third-party typed data remains reviewable for every signing account", async () => {
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
        reset();
        await queue(type, "ordinary", { signature: { method: "eth_signTypedData_v4", params: [address, accountExecutionTypedData("0x3333333333333333333333333333333333333333")], chainId: 1 } });
        assert.equal((await confirmationPolicy.prepareSignatureConfirmation("ordinary")).ok, true);
      }
    });

    await t.test("old pending deprecated methods cannot bypass the external signature policy", async () => {
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
        for (const method of ["eth_signTypedData", "eth_sign"] as const) {
          reset();
          await queue(type, "deprecated", { signature: { method, params: [address, accountExecutionTypedData(address)], chainId: 1 } });
          hooks.local = async () => { assert.fail("local signer must not run"); };
          hooks.bankr = async () => { assert.fail("Bankr API must not run"); };
          const result = type === "ledger"
            ? await ledgerHandlers.handleConfirmLedgerSignatureRequest("deprecated", "agent-password", undefined, true)
            : type === "bankr"
              ? await handlers.handleConfirmSignatureRequestBankr("deprecated", "agent-password", true)
              : await handlers.handleConfirmSignatureRequest("deprecated", "agent-password", undefined, true);
          assert.equal(result.success, false);
          assert.match(result.error, /deprecated/);
          assert.equal(await pendingStorage.getPendingSignatureRequestById("deprecated"), null);
        }
      }
    });

    await t.test("imported SafeTx remains reviewable and releasable through all four signer handlers", async () => {
      const safeAddress = "0x3333333333333333333333333333333333333333";
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
        for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"] as const) {
          reset();
          const data = safeTransactionTypedData(safeAddress);
          await queue(type, "safe-owner", { signature: { method, params: [address, JSON.stringify(data)], chainId: 1 } });
          (local.accounts as unknown[]).push({ id: "safe", type: "safe", address: safeAddress, createdAt: 1 });
          const prepared = await confirmationPolicy.prepareSignatureConfirmation("safe-owner");
          assert.equal(prepared.ok, true, JSON.stringify(prepared));
          // Only device I/O is mocked; the Ledger confirmation/release policy is real.
          hooks.ledgerSession = async () => {};
          hooks.ledger = async () => `0x${"dd".repeat(65)}`;
          hooks.privateKey = privateKey;
          hooks.apiKey = "bankr-api-key";
          const result = type === "ledger"
            ? await ledgerHandlers.handleConfirmLedgerSignatureRequest("safe-owner", "master-password")
            : type === "bankr"
            ? await handlers.handleConfirmSignatureRequestBankr("safe-owner", "master-password")
            : await handlers.handleConfirmSignatureRequest("safe-owner", "master-password");
          assert.equal(result.success, true, JSON.stringify(result));
          assert.match(result.signature, /^0x[0-9a-f]+$/);
        }
      }
    });

    await t.test("Safe delegatecall and refund warnings do not rewrite or block the exact owner signature", async () => {
      const safeAddress = "0x3333333333333333333333333333333333333333";
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const tokenAddress = "0x4444444444444444444444444444444444444444";
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
        for (const method of ["eth_signTypedData_v3", "eth_signTypedData_v4"] as const) {
          for (const gasToken of [zeroAddress, tokenAddress]) {
            reset();
            const id = `safe-risk-${type}-${method}-${gasToken}`;
            const data = safeTransactionTypedData(safeAddress);
            Object.assign(data.message, {
              to: "0x5555555555555555555555555555555555555555",
              value: "0",
              data: "0x12345678abcdef",
              operation: 1,
              safeTxGas: "50000",
              baseGas: "1000000000",
              gasPrice: "1000000000",
              gasToken,
              refundReceiver: gasToken === zeroAddress ? zeroAddress : tokenAddress,
              nonce: 17,
            });
            const expected = clone(data);
            await queue(type, id, {
              signature: {
                method,
                params: [address, method === "eth_signTypedData_v3" ? data : JSON.stringify(data)],
                chainId: 1,
              },
            });
            // The Safe need not be imported for an owner to sign its transaction.
            let signCount = 0;
            const assertSignedPayload = (signedMethod: unknown, signedParams: unknown) => {
              signCount += 1;
              assert.equal(signedMethod, method);
              assert.ok(Array.isArray(signedParams));
              assert.equal(signedParams[0], address);
              const actual = typeof signedParams[1] === "string"
                ? JSON.parse(signedParams[1])
                : signedParams[1];
              assert.deepEqual(actual, expected, `${type} must preserve every signed Safe field`);
              return `0x${"dd".repeat(65)}`;
            };
            hooks.local = async (_key, signedMethod, signedParams, chainId) => {
              assert.equal(chainId, 1);
              return assertSignedPayload(signedMethod, signedParams);
            };
            hooks.bankr = async (_key, signedMethod, signedParams) => ({
              signature: assertSignedPayload(signedMethod, signedParams),
            });
            hooks.ledgerSession = async () => {};
            hooks.ledger = async (request) => {
              const signed = request as { method: unknown; params: unknown; chainId: number };
              assert.equal(signed.chainId, 1);
              return assertSignedPayload(signed.method, signed.params);
            };
            hooks.privateKey = privateKey;
            hooks.apiKey = "bankr-api-key";
            const result = type === "ledger"
              ? await ledgerHandlers.handleConfirmLedgerSignatureRequest(id, "agent-password")
              : type === "bankr"
                ? await handlers.handleConfirmSignatureRequestBankr(id, "agent-password")
                : await handlers.handleConfirmSignatureRequest(id, "agent-password");
            assert.equal(result.success, true, JSON.stringify(result));
            assert.equal(signCount, 1, `${type} must sign the reviewed payload exactly once`);
            assert.deepEqual(data, expected, "caller payload must remain unchanged");
            assert.equal(await pendingStorage.getPendingSignatureRequestById(id), null);
          }
        }
      }
    });

    await t.test("SafeTx type cannot exempt a protected EOA and view-only verifiers are not signers", async () => {
      const target = "0x3333333333333333333333333333333333333333";
      const externalPolicy = await viteServer!.ssrLoadModule("/src/chrome/signatures/externalTypedData.ts");
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr", "safe", "impersonator"] as const) {
        local.accounts = [{ id: "target", type, address: target, createdAt: 1 }];
        const result = await externalPolicy.validateExternalSignatureTypedData({ method: "eth_signTypedData_v4", params: [address, safeTransactionTypedData(target)], chainId: 1 }, address);
        assert.equal(result.valid, type === "safe" || type === "impersonator", type);
      }
      local.accounts = [{ id: "safe", type: "safe", address, createdAt: 1 }];
      const self = await externalPolicy.validateExternalSignatureTypedData({ method: "eth_signTypedData_v4", params: [address, safeTransactionTypedData(address)], chainId: 1 }, address);
      assert.equal(self.valid, false, "the pinned signer always remains protected");
    });

    await t.test("view-only and Safe accounts cannot reach generic signature approval", async () => {
      for (const type of ["impersonator", "safe"] as const) {
        reset();
        await queue("privateKey", "non-signer");
        (local.accounts as Array<{ type: string }>)[0].type = type;
        const result = await handlers.handleConfirmSignatureRequest("non-signer", "master-password");
        assert.equal(result.success, false);
        assert.equal(result.signature, undefined);
      }
    });

    await t.test("changing the selected account cannot change a pending request's protected signer", async () => {
      reset();
      await queue("privateKey", "selection-change", { signature: { method: "eth_signTypedData_v4", params: [address, accountExecutionTypedData(address)], chainId: 1 } });
      (local.accounts as unknown[]).push({ id: "other", type: "ledger", address: "0x3333333333333333333333333333333333333333", createdAt: 1 });
      sync.activeAccountId = "other";
      const result = await confirmationPolicy.prepareSignatureConfirmation("selection-change");
      assert.equal(result.ok, false);
      assert.equal(result.result.error, INTERNAL_ACCOUNT_TYPED_DATA_ERROR);
    });

    await t.test("an account imported while signing prevents release for every signer transport", async () => {
      for (const type of ["privateKey", "seedPhrase", "ledger", "bankr"] as const) {
        reset();
        const target = "0x3333333333333333333333333333333333333333";
        await queue(type, "import-race", { signature: { method: "eth_signTypedData_v4", params: [address, accountExecutionTypedData(target)], chainId: 1 } });
        hooks.privateKey = privateKey;
        hooks.apiKey = "bankr-api-key";
        const sign = async () => {
          (local.accounts as unknown[]).push({ id: "imported", type: "ledger", address: target, createdAt: 1 });
          return `0x${"cc".repeat(65)}`;
        };
        hooks.local = sign;
        hooks.bankr = async () => ({ signature: await sign() });
        hooks.ledgerSession = async () => {};
        hooks.ledger = sign;
        const result = type === "ledger"
          ? await ledgerHandlers.handleConfirmLedgerSignatureRequest("import-race", "master-password")
          : type === "bankr"
            ? await handlers.handleConfirmSignatureRequestBankr("import-race", "master-password")
            : await handlers.handleConfirmSignatureRequest("import-race", "master-password");
        assert.equal(result.success, false, type);
        assert.equal(result.signature, undefined, type);
        assert.equal(result.error, INTERNAL_ACCOUNT_TYPED_DATA_ERROR, type);
        assert.equal(await pendingStorage.getPendingSignatureRequestById("import-race"), null, type);
      }
    });

    await t.test(
      "shared preflight preserves typed-data signer positions",
      async () => {
        for (const signature of [
          {
            method: "eth_signTypedData_v4" as const,
            params: [
              address,
              {
                types: { EIP712Domain: [] },
                primaryType: "EIP712Domain",
                domain: {},
                message: {},
              },
            ],
            chainId: 1,
          },
        ]) {
          reset();
          const id = `policy-${signature.method}`;
          await queue("privateKey", id, { signature });
          const result =
            await confirmationPolicy.prepareSignatureConfirmation(id);
          assert.equal(result.ok, true, JSON.stringify(result));
        }

        reset();
        await queue("privateKey", "policy-eth-sign-mismatch", {
          signature: {
            method: "eth_signTypedData_v4",
            params: [`0x${"22".repeat(20)}`, safeTransactionTypedData("0x3333333333333333333333333333333333333333")],
            chainId: 1,
          },
        });
        const mismatch =
          await confirmationPolicy.prepareSignatureConfirmation(
            "policy-eth-sign-mismatch",
          );
        assert.equal(mismatch.ok, false);
        assert.equal(
          mismatch.result.error,
          "Signer address does not match active account",
        );
      },
    );

    await t.test(
      "shared preflight blocks cross-origin SIWE unless explicitly overridden",
      async () => {
        reset();
        const siweMessage = [
          "malicious.example wants you to sign in with your Ethereum account:",
          address,
          "",
          "Sign in to continue.",
          "",
          "URI: https://malicious.example/login",
          "Version: 1",
          "Chain ID: 1",
          "Nonce: abcdef12",
          `Issued At: ${new Date().toISOString()}`,
        ].join("\n");
        await queue("privateKey", "siwe-origin-mismatch", {
          signature: {
            method: "personal_sign",
            params: [siweMessage, address],
            chainId: 1,
          },
          origin: "app.example",
          senderOrigin: "https://app.example",
        });

        const blocked =
          await confirmationPolicy.prepareSignatureConfirmation(
            "siwe-origin-mismatch",
          );
        assert.equal(blocked.ok, false);
        assert.match(blocked.result.error ?? "", /SIWE validation failed/);

        const overridden =
          await confirmationPolicy.prepareSignatureConfirmation(
            "siwe-origin-mismatch",
            true,
          );
        assert.equal(overridden.ok, true, JSON.stringify(overridden));
      },
    );

    await t.test("account replacement during signing suppresses release", async () => {
      reset();
      const { account } = await queue("privateKey", "local-race");
      hooks.privateKey = privateKey;

      let beginSigning!: () => void;
      let releaseSigning!: () => void;
      const signingStarted = new Promise<void>((resolve) => {
        beginSigning = resolve;
      });
      const signingGate = new Promise<void>((resolve) => {
        releaseSigning = resolve;
      });
      hooks.local = async () => {
        beginSigning();
        await signingGate;
        return `0x${"cc".repeat(65)}`;
      };

      const confirmation = handlers.handleConfirmSignatureRequest(
        "local-race",
        "master-password",
      );
      await signingStarted;
      local.accounts = [{ ...account, address: `0x${"22".repeat(20)}` }];
      releaseSigning();

      const result = await confirmation;
      assert.equal(result.success, false);
      assert.equal(result.signature, undefined);
      assert.equal(result.error, "Pending request is no longer valid");
    });
  } finally {
    await viteServer?.close();
    Reflect.deleteProperty(globalThis, "__walletchanSignatureTestHooks");
    if (originalChrome) {
      Object.defineProperty(globalThis, "chrome", originalChrome);
    } else {
      delete (globalThis as { chrome?: unknown }).chrome;
    }
  }
});
