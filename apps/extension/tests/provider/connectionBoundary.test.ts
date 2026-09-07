import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { authorizeConnectedDappRequest } from "../../src/chrome/dapp/requestPolicy";

const ACTUAL_ADDRESS = "0x1111111111111111111111111111111111111111";
const UNCONNECTED_ADDRESS = "0x0000000000000000000000000000000000000000";
const DAPP_ORIGIN = "https://app.example";

type RuntimeListener = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
) => boolean | void;

test("provider bridge exposes account state and network mutation only to connected sites", async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");

  const posts: any[] = [];
  const runtimeMessages: any[] = [];
  const syncWrites: Record<string, unknown>[] = [];
  const windowListeners = new Map<string, Set<(event: any) => unknown>>();
  let runtimeListener: RuntimeListener | undefined;
  let injectedScript: any;
  let connected = false;
  let accountType = "privateKey";
  let connectionDecision: "approve" | "reject" | "hold" = "approve";
  let deniedChainId: number | undefined;
  let revokeOnTargetRead = false;
  const storageListeners = new Set<(changes: any, area: string) => void>();
  const completeConnection = (requestId: string, approve: boolean) => {
    connected = approve;
    const key = `dappConnectionResult:${requestId}`;
    const newValue = { result: approve
      ? { success: true, accounts: [ACTUAL_ADDRESS] }
      : { success: false, error: "User rejected the connection request", code: 4001 } };
    localState[key] = newValue;
    for (const listener of storageListeners) listener({ [key]: { newValue } }, "local");
  };
  const localState: Record<string, unknown> = { dappPermissions: {} };
  const syncState = {
    address: ACTUAL_ADDRESS,
    displayAddress: "Main",
    chainName: "Base",
    networksInfo: {
      Base: { chainId: 8453, rpcUrl: "https://base.example" },
      Ethereum: {
        chainId: 1,
        rpcUrl: "https://rpc.example",
        explorer: "https://etherscan.io",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
    },
  };

  const fakeLocation = {
    hostname: "app.example",
    href: `${DAPP_ORIGIN}/page`,
    origin: DAPP_ORIGIN,
    replace() {
      throw new Error("unexpected redirect");
    },
  };
  const fakeWindow: any = {
    top: undefined,
    location: fakeLocation,
    setTimeout,
    addEventListener(type: string, listener: (event: any) => unknown) {
      const listeners = windowListeners.get(type) || new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type: string, listener: (event: any) => unknown) {
      windowListeners.get(type)?.delete(listener);
    },
    postMessage(message: any) {
      posts.push(message);
    },
  };
  fakeWindow.top = fakeWindow;

  const fakeDocument: any = {
    title: "Provider boundary test",
    readyState: "complete",
    querySelector() {
      return null;
    },
    addEventListener() {},
    createElement() {
      return {
        src: "",
        onload: undefined,
        setAttribute() {},
        remove() {},
      };
    },
    head: {
      prepend(script: any) {
        injectedScript = script;
      },
    },
    documentElement: {
      prepend(script: any) {
        injectedScript = script;
      },
    },
  };

  const select = (
    source: Record<string, unknown>,
    keys?: string | string[] | null,
  ): Record<string, unknown> => {
    if (keys == null) return { ...source };
    if (typeof keys === "string") return { [keys]: source[keys] };
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
  };

  const fakeChrome = {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://walletchan/${path.replace(/^\//, "")}`;
      },
      onMessage: {
        addListener(listener: RuntimeListener) {
          runtimeListener = listener;
        },
      },
      async sendMessage(message: any) {
        runtimeMessages.push(message);
        if (message.type === "getActiveAccount") {
          return {
            id: "account-1",
            type: accountType,
            address: ACTUAL_ADDRESS,
            displayName: "Main",
          };
        }
        if (message.type === "requestDappConnection") {
          if (connectionDecision !== "hold") completeConnection(message.requestId, connectionDecision === "approve");
          return;
        }
        if (message.type === "getDappAccounts") {
          if (revokeOnTargetRead && message.chainId !== undefined) {
            revokeOnTargetRead = false;
            connected = false;
            runtimeListener?.({ type: "dappPermissionRevoked" }, {}, () => {});
          }
          return {
            success: true,
            accounts: connected && (deniedChainId === undefined || message.chainId !== deniedChainId) ? [ACTUAL_ADDRESS] : [],
          };
        }
        return { success: true };
      },
    },
    storage: {
      sync: {
        async get(keys?: string | string[] | null) {
          return select(syncState as unknown as Record<string, unknown>, keys);
        },
        async set(values: Record<string, unknown>) {
          syncWrites.push(values);
          Object.assign(syncState, values);
        },
      },
      local: {
        async get(keys?: string | string[] | null) {
          return select(localState, keys);
        },
        async remove(key: string) { delete localState[key]; },
      },
      onChanged: {
        addListener(listener: any) { storageListeners.add(listener); },
        removeListener(listener: any) { storageListeners.delete(listener); },
      },
    },
  };

  const restore = (
    name: "window" | "document" | "location" | "chrome",
    descriptor: PropertyDescriptor | undefined,
  ) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  };
  const flush = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  };
  const dispatchWindowMessage = async (data: any) => {
    for (const listener of windowListeners.get("message") || []) {
      await listener({ source: fakeWindow, data });
    }
    await flush();
  };
  const dispatchRuntimeMessage = async (message: any) => {
    assert.ok(runtimeListener, "content-script runtime listener should be installed");
    runtimeListener(message, {}, () => undefined);
    await flush();
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: fakeLocation,
  });
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: fakeChrome,
  });

  try {
    await import("../../src/chrome/inject");
    assert.ok(injectedScript?.onload, "inject.ts should install its inpage script");

    await t.test("init hides the active wallet from an unconnected site", async () => {
      posts.length = 0;
      connected = false;
      await injectedScript.onload.call(injectedScript);
      await flush();

      const initMessage = posts.find((message) => message.type === "init");
      assert.equal(initMessage?.msg.chainId, 1);
      assert.equal(initMessage?.msg.address, UNCONNECTED_ADDRESS);
      assert.notEqual(initMessage?.msg.address, ACTUAL_ADDRESS);
    });

    await t.test("unconnected initialization does not require a saved chain", async () => {
      syncState.chainName = "";
      connected = false;
      posts.length = 0;
      await injectedScript.onload.call(injectedScript);
      assert.equal(posts.find((m) => m.type === "init")?.msg.chainId, 1);
      syncState.chainName = "Base";
    });

    await t.test("setAddress stays hidden until the site is connected", async () => {
      posts.length = 0;
      connected = false;
      await dispatchRuntimeMessage({
        type: "setAddress",
        msg: { address: ACTUAL_ADDRESS, displayAddress: "Main" },
      });
      const hidden = posts.find((message) => message.type === "setAddress");
      assert.equal(hidden?.msg.address, UNCONNECTED_ADDRESS);
      assert.equal(hidden?.msg.emitAccountsChanged, false);

      posts.length = 0;
      connected = true;
      await dispatchRuntimeMessage({
        type: "setAddress",
        msg: { address: ACTUAL_ADDRESS, displayAddress: "Main" },
      });
      const exposed = posts.find((message) => message.type === "setAddress");
      assert.equal(exposed?.msg.address, ACTUAL_ADDRESS);
    });

    await t.test("unconnected chain updates stay mainnet; revoke resets a connected chain", async () => {
      connected = false;
      posts.length = 0;
      await dispatchRuntimeMessage({ type: "setChainId", msg: { chainId: 8453, chainName: "Base" } });
      assert.equal(posts.at(-1)?.msg.chainId, 1);
      connected = true;
      await dispatchRuntimeMessage({ type: "setChainId", msg: { chainId: 8453, chainName: "Base" } });
      assert.equal(posts.at(-1)?.msg.chainId, 8453);
      await dispatchRuntimeMessage({ type: "dappPermissionRevoked" });
      assert.ok(posts.some((p) => p.type === "setChainId" && p.msg.chainId === 1));
    });

    for (const type of ["privateKey", "seedPhrase", "ledger", "bankr", "impersonator", "safe"]) {
      await t.test(`${type}: switch-before-connect preserves target and synchronizes renderer context`, async () => {
        accountType = type;
        connected = false;
        connectionDecision = "approve";
        posts.length = 0;
        runtimeMessages.length = 0;
        syncWrites.length = 0;
        await dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: type, chainId: 8453 } });
        assert.equal(runtimeMessages.find((m) => m.type === "requestDappConnection")?.chainId, 8453);
        assert.ok(posts.some((m) => m.type === "switchEthereumChain" && m.msg.chainId === 8453 && m.msg.id === type));
        assert.deepEqual(syncWrites, [{ chainName: "Base" }]);
        assert.ok(runtimeMessages.some((m) => m.type === "getDappAccounts" && m.chainId === 8453));
        assert.equal(runtimeMessages.some((m) => /sign|sendTransaction/i.test(m.type)), false);
      });
    }
    accountType = "privateKey";

    await t.test("rejection, unknown chain, malformed chain, and final permission loss never switch", async () => {
      for (const scenario of ["reject", "unknown", "invalid", "revoked", "unsupported-account"]) {
        connected = false;
        connectionDecision = scenario === "reject" ? "reject" : "approve";
        deniedChainId = scenario === "unsupported-account" ? 8453 : undefined;
        revokeOnTargetRead = scenario === "revoked";
        posts.length = 0;
        runtimeMessages.length = 0;
        const chainId = scenario === "unknown" ? 999999999 : scenario === "invalid" ? {} : 8453;
        await dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: scenario, chainId } });
        assert.equal(posts.some((m) => m.type === "switchEthereumChain"), false);
        const failure = posts.find((m) => m.type === "switchEthereumChainError");
        assert.equal(failure?.msg.code, scenario === "reject" ? 4001 : scenario === "unknown" ? 4902 : scenario === "invalid" ? -32602 : 4100);
        if (scenario === "unknown" || scenario === "invalid") {
          assert.equal(runtimeMessages.some((m) => m.type === "requestDappConnection"), false);
        }
      }
      deniedChainId = undefined;
    });

    await t.test("connected switch skips approval and Bankr rejects custom networks", async () => {
      connected = true;
      runtimeMessages.length = 0;
      posts.length = 0;
      await dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: "connected", chainId: 1 } });
      assert.equal(runtimeMessages.some((m) => m.type === "requestDappConnection"), false);
      assert.ok(posts.some((m) => m.type === "switchEthereumChain" && m.msg.id === "connected"));
      (syncState.networksInfo as Record<string, any>).Custom = {
        chainId: 123456789, rpcUrl: "https://custom.example", isCustom: true,
      };
      accountType = "bankr";
      posts.length = 0;
      await dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: "unsupported", chainId: 123456789 } });
      assert.equal(posts.find((m) => m.type === "switchEthereumChainError")?.msg.code, 4200);
      accountType = "privateKey";
    });

    await t.test("pending switches reject duplicates and retain the original target through UI updates", async () => {
      connected = false;
      connectionDecision = "hold";
      runtimeMessages.length = 0;
      posts.length = 0;
      const pending = dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: "first", chainId: 8453 } });
      await flush();
      await dispatchWindowMessage({ type: "i_switchEthereumChain", msg: { id: "second", chainId: 1 } });
      assert.ok(posts.some((m) => m.msg.id === "second" && m.msg.code === -32002));
      await dispatchRuntimeMessage({ type: "setChainId", msg: { chainName: "Ethereum", chainId: 1 } });
      const request = runtimeMessages.find((m) => m.type === "requestDappConnection");
      assert.ok(request);
      completeConnection(request.requestId, true);
      await pending;
      assert.ok(posts.some((m) => m.type === "switchEthereumChain" && m.msg.id === "first" && m.msg.chainId === 8453));
      connectionDecision = "approve";
    });

    await t.test("add-chain fails with 4100 until connected", async () => {
      posts.length = 0;
      connected = false;
      await dispatchWindowMessage({
        type: "i_addEthereumChain",
        msg: { id: "add-denied", chainId: 1 },
      });
      const denied = posts.find(
        (message) => message.type === "addEthereumChainResult",
      );
      assert.equal(denied?.msg.id, "add-denied");
      assert.equal(denied?.msg.code, 4100);

      posts.length = 0;
      connected = true;
      await dispatchWindowMessage({
        type: "i_addEthereumChain",
        msg: { id: "add-allowed", chainId: 1 },
      });
      const allowed = posts.find(
        (message) =>
          message.type === "addEthereumChainResult" &&
          message.msg.id === "add-allowed",
      );
      assert.equal(allowed?.msg.success, true);
    });

    await t.test("an existing hidden chain enters the approval flow", async () => {
      posts.length = 0;
      runtimeMessages.length = 0;
      connected = true;
      (syncState.networksInfo as Record<string, any>)["Base Sepolia"] = {
        chainId: 84532,
        rpcUrl: "https://base-sepolia.drpc.org",
        explorer: "https://sepolia.basescan.org",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        hidden: true,
      };

      await dispatchWindowMessage({
        type: "i_addEthereumChain",
        msg: {
          id: "add-hidden",
          chainId: 84532,
          chainName: "Base Sepolia",
          rpcUrls: ["https://dapp-rpc.example"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        },
      });

      assert.equal(
        posts.some(
          (message) =>
            message.type === "addEthereumChainResult" &&
            message.msg.id === "add-hidden",
        ),
        false,
        "the dapp must wait for the user's approval",
      );
      assert.ok(
        runtimeMessages.some(
          (message) =>
            message.type === "addEthereumChain" &&
            message.chainId === 84532 &&
            message.rpcUrls?.[0] === "https://dapp-rpc.example",
        ),
      );
    });

    await t.test("watch/add background intake uses the exact-origin connection policy", async () => {
      const sender = {
        origin: DAPP_ORIGIN,
        url: `${DAPP_ORIGIN}/page`,
        frameId: 0,
        tab: { id: 7, url: `${DAPP_ORIGIN}/page` },
      } as chrome.runtime.MessageSender;

      localState.dappPermissions = {};
      const denied = await authorizeConnectedDappRequest(sender);
      assert.equal(denied.authorized, false, "unconnected watch/add must be denied");

      localState.dappPermissions = {
        [DAPP_ORIGIN]: {
          origin: DAPP_ORIGIN,
          hostname: "app.example",
          approvedAt: 1,
          lastConnectedAt: 1,
        },
      };
      const allowed = await authorizeConnectedDappRequest(sender);
      assert.deepEqual(allowed, {
        authorized: true,
        origin: DAPP_ORIGIN,
        tabId: 7,
      });

      for (const [file, caseName, nextCase] of [
        [
          "background/watchAssetRouter.ts",
          "watchAsset",
          "getPendingWatchAssetRequests",
        ],
        [
          "background/chainPromptRouter.ts",
          "addEthereumChain",
          "getPendingAddChainRequests",
        ],
      ]) {
        const source = await readFile(
          new URL(`../../src/chrome/${file}`, import.meta.url),
          "utf8",
        );
        const start = source.indexOf(`case "${caseName}":`);
        const end = source.indexOf(`case "${nextCase}":`, start);
        assert.ok(start >= 0 && end > start, `${caseName} handler should exist`);
        assert.match(
          source.slice(start, end),
          /authorizeConnectedDappRequest\(\s*sender\s*\)/,
          `${caseName} must invoke the exact-origin policy`,
        );
      }
    });
  } finally {
    restore("window", originalWindow);
    restore("document", originalDocument);
    restore("location", originalLocation);
    restore("chrome", originalChrome);
  }
});
