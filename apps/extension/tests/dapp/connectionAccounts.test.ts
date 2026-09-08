import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Run the real connection handlers with isolated storage/windowing boundaries.
// No signer, device, network request, or real browser state is involved.
const source = await readFile(
  new URL("../../src/chrome/dapp/connectionHandlers.ts", import.meta.url), "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const origin = "https://app.example";
const address = "0x1111111111111111111111111111111111111111";
const sender = { origin, frameId: 0, tab: { id: 7, url: origin, windowId: 1 } };

function harness(type = "safe", capability = "observe") {
  const state = {
    account: { id: "selected", type, address },
    record: { accountId: "selected", address, chains: { "8453": { capability } } } as any,
    permission: false,
    featureEnabled: true,
    tabUrl: origin,
    pending: [] as any[],
    results: new Map<string, any>(),
    prompts: 0,
  };
  const dependencies: Record<string, any> = {
    "../accountStorage": {
      getActiveAccount: async () => state.account,
      getTabAccount: async () => state.account,
      clearTabAccount: async () => {},
    },
    "../requests/dappPermissionStorage": {
      normalizeDappOrigin: (url: string) => new URL(url).origin,
      getDappPermission: async () => state.permission,
      getPendingDappConnectionRequests: async () => state.pending,
      savePendingDappConnectionRequest: async (request: any) => state.pending.push(request),
      removePendingDappConnectionRequests: async (predicate: (request: any) => boolean) => {
        const removed = state.pending.filter(predicate);
        state.pending = state.pending.filter((request) => !predicate(request));
        return removed;
      },
      grantDappPermission: async () => { state.permission = true; },
      touchDappPermission: async () => {},
    },
    "../txHandlers": {
      writeResultToStorage: async (key: string, result: any) => state.results.set(key, result),
      openExtensionPopup: async () => { state.prompts++; },
    },
    "./accountScope": { tabHasDappAccountScope: async () => false },
    "../requests/pendingDappRequestLifecycle": {},
    "../requests/pendingRequestLifecycle": {},
    "../windowing/providerRequestSurface": { clearProviderRequestSurfaceHint: () => {} },
    "./accountRemovalPrivacy": { withDappAccountBinding: (work: () => unknown) => work() },
    "../safe/accountRepository": {
      getSafeAccountRecord: async (id: string) => state.record?.accountId === id ? state.record : null,
    },
    "../safe/featurePolicy": { isSafeFeatureEnabled: () => state.featureEnabled },
  };
  const exports: any = {};
  new Function("require", "exports", "chrome", compiled)(
    (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
    exports,
    {
      runtime: { sendMessage: async () => {} },
      tabs: { get: async () => ({ id: 7, url: state.tabUrl }) },
    },
  );
  return { state, handlers: exports };
}

test("all account types can connect and expose only the selected address after approval", async (t) => {
  for (const type of ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"]) {
    await t.test(type, async () => {
      const { state, handlers } = harness(type);
      assert.deepEqual(await handlers.handleGetDappAccounts({ chainId: 1 }, sender), {
        success: true, accounts: [],
      });
      await handlers.handleRequestDappConnection({ requestId: "connect", chainId: 1 }, sender);
      assert.equal(state.prompts, 1);
      assert.equal(state.permission, false);
      assert.equal(state.results.size, 0);
      assert.deepEqual(await handlers.handleConfirmDappConnection("connect"), { success: true });
      assert.deepEqual(state.results.get("dappConnectionResult:connect"), {
        success: true, accounts: [address],
      });
      assert.deepEqual(await handlers.handleGetDappAccounts({ chainId: 1 }, sender), {
        success: true, accounts: [address],
      });
    });
  }
});

test("Safe selection during a pending connection is independent of cached signing capability and chain", async (t) => {
  for (const capability of ["observe", "blocked", "approve", "quorumAvailable", "readyToExecute"]) {
    await t.test(capability, async () => {
      const { state, handlers } = harness("privateKey", capability);
      await handlers.handleRequestDappConnection({ requestId: "connect", chainId: 1 }, sender);
      state.account = { id: "safe", type: "safe", address };
      state.record.accountId = "safe";
      assert.deepEqual(await handlers.handleConfirmDappConnection("connect"), { success: true });
      assert.deepEqual(state.results.get("dappConnectionResult:connect").accounts, [address]);
      // A previously granted site gets the same address when reconnecting.
      await handlers.handleRequestDappConnection({ requestId: "again", chainId: 1 }, sender);
      assert.deepEqual(state.results.get("dappConnectionResult:again").accounts, [address]);
      assert.equal(state.prompts, 1);
    });
  }
});

test("Safe connection still requires an imported record and enabled provider feature", async (t) => {
  for (const failure of ["missing-record", "feature-disabled"]) {
    await t.test(failure, async () => {
      const { state, handlers } = harness();
      await handlers.handleRequestDappConnection({ requestId: "pending", chainId: 1 }, sender);
      if (failure === "missing-record") state.record = null;
      else state.featureEnabled = false;
      assert.equal((await handlers.handleConfirmDappConnection("pending")).success, false);
      assert.equal(state.permission, false);
      await handlers.handleRequestDappConnection({ requestId: "new", chainId: 1 }, sender);
      assert.equal(state.results.get("dappConnectionResult:new").code, 4200);
      state.permission = true;
      assert.deepEqual((await handlers.handleGetDappAccounts({}, sender)).accounts, []);
    });
  }
});

test("Safe connection preserves rejection, subframe, and navigation protections", async () => {
  const { state, handlers } = harness();
  await handlers.handleRequestDappConnection({ requestId: "frame" }, { ...sender, frameId: 1 });
  assert.equal(state.results.get("dappConnectionResult:frame").code, 4100);
  assert.equal(state.prompts, 0);
  await handlers.handleRequestDappConnection({ requestId: "reject" }, sender);
  await handlers.handleRejectDappConnection("reject");
  assert.equal(state.results.get("dappConnectionResult:reject").code, 4001);
  assert.equal(state.permission, false);
  await handlers.handleRequestDappConnection({ requestId: "navigate" }, sender);
  state.tabUrl = "https://other.example";
  assert.equal((await handlers.handleConfirmDappConnection("navigate")).success, false);
  assert.equal(state.permission, false);
});

test("the open connection picker offers every account without a Safe capability lookup", async () => {
  const pickerSource = await readFile(
    new URL("../../src/components/DappConnectionAccountSelector.tsx", import.meta.url), "utf8",
  );
  const pickerCode = ts.transpileModule(pickerSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, jsxFactory: "element",
    },
    fileName: "DappConnectionAccountSelector.tsx",
  }).outputText;
  const accounts = ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"]
    .map((type) => ({ id: type, type, address }));
  const rows: any[] = [];
  const selected: string[] = [];
  const effects: (() => void)[] = [];
  let stateIndex = 0;
  const hooks = {
    useState: () => [stateIndex++ === 0 ? true : null, () => {}],
    useRef: () => ({ current: null }),
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void) => effects.push(effect),
  };
  const identities = {
    getDisplayName: (account: any) => account.id,
    getEnsAvatar: () => null,
    getSecondaryIdentity: () => address,
  };
  const exports: any = {};
  new Function("require", "exports", "element", "requestAnimationFrame", "document", "React", pickerCode)(
    (id: string) => {
      if (id === "react") return hooks;
      if (id.endsWith("useAccountIdentityLabels")) return { useAccountIdentityLabels: () => identities };
      if (id.endsWith("useSeedGroupMap")) return { useSeedGroupMap: () => ({}) };
      if (id.endsWith("accountIdentityLabels")) return { getWalletTypeLabel: (account: any) => account.type };
      if (id.endsWith("accountExplorerUtils")) return { getDefaultAccountExplorerUrl: () => "https://example.com" };
      if (id.endsWith("addressUtils")) return { truncateAddress: () => address };
      return new Proxy({}, { get: (_target, name) => name });
    },
    exports,
    (type: string, props: any) => { if (type === "AccountPickerRow") rows.push(props); },
    () => 0,
    { addEventListener: () => {} },
    { Fragment: "Fragment" },
  );
  exports.default({ accounts, account: { id: "previous" }, chainId: 1,
    onAccountSelect: (account: any) => selected.push(account.id) });
  // Running mount effects would fail if the picker still needed a Safe RPC.
  for (const effect of effects) effect();
  assert.equal(rows.length, accounts.length);
  for (const row of rows) {
    assert.equal(row.isDisabled, false, row.account.type);
    assert.equal(row.statusLabel, undefined, row.account.type);
    row.onSelect();
  }
  assert.deepEqual(selected, accounts.map((account) => account.id));
});
