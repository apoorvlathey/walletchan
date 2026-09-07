import assert from "node:assert/strict";
import test from "node:test";
import { startInpageProvider } from "../../src/chrome/provider/inpage/bootstrap";
import { useSameOriginTopProvider } from "../../src/chrome/provider/inpage/sameOriginFrame";

class Page extends EventTarget {
  location = { origin: "https://etherscan.io" };
  top: Page = this;
  ethereum?: unknown;
}

test("same-origin contract frames discover and call the top provider, including late initialization", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const late of [false, true]) {
      const top = new Page();
      const child = new Page();
      child.top = top;
      Object.defineProperty(globalThis, "window", { configurable: true, value: child });
      const calls: unknown[] = [];
      const provider = {
        request: async (request: unknown) => { calls.push(request); return []; },
      };
      const announce = () => top.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
        detail: { info: { rdns: "com.walletchan" }, provider },
      }));
      if (!late) top.addEventListener("eip6963:requestProvider", announce);
      const discovered: any[] = [];
      child.addEventListener("eip6963:announceProvider", (event) => {
        discovered.push((event as CustomEvent).detail);
      });
      startInpageProvider();
      if (late) {
        assert.equal(child.ethereum, undefined);
        top.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
          detail: { info: { rdns: "io.rabby" }, provider: {} },
        }));
        assert.equal(child.ethereum, undefined);
        announce();
      }
      assert.equal(child.ethereum, provider);
      assert.equal(discovered.at(-1).provider, provider);
      await discovered.at(-1).provider.request({ method: "eth_requestAccounts" });
      assert.deepEqual(calls, [{ method: "eth_requestAccounts" }]);
      // The child's own init/result traffic must not replace the shared object.
      child.dispatchEvent(new MessageEvent("message", {
        data: { type: "init", msg: { chainId: 1, address: "0x0000000000000000000000000000000000000000" } },
      }));
      assert.equal(child.ethereum, provider);
      child.dispatchEvent(new Event("eip6963:requestProvider"));
      assert.equal(discovered.at(-1).provider, provider);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("cross-origin, opaque, and top-level pages never acquire a top provider", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    const top = new Page();
    const cross = new Page();
    cross.top = top;
    cross.location.origin = "https://other.example";
    const opaque = new Page();
    opaque.top = top;
    opaque.location.origin = "null";
    const inaccessible = new Page();
    Object.defineProperty(inaccessible, "top", { get() { throw new Error("SecurityError"); } });
    for (const page of [top, cross, opaque, inaccessible]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: page });
      assert.equal(useSameOriginTopProvider(), false);
      assert.equal(page.ethereum, undefined);
    }
    const child = new Page();
    child.top = top;
    Object.defineProperty(globalThis, "window", { configurable: true, value: child });
    assert.equal(useSameOriginTopProvider(), true);
    child.dispatchEvent(new Event("pagehide"));
    top.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: { info: { rdns: "com.walletchan" }, provider: { request() {} } },
    }));
    assert.equal(child.ethereum, undefined, "unloaded frame listener is removed");
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
