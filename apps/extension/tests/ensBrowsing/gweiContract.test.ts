import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAbiParameters,
  stringToHex,
  toFunctionSelector,
  type PublicClient,
} from "viem";
import { encode } from "@ensdomains/content-hash";
import {
  fetchGweiHtml,
  parseGweiContentContract,
} from "../../src/chrome/ensBrowsing/gweiContract";
import { resolveGwei } from "../../src/chrome/ensBrowsing/resolver";
import { buildHostedGatewayUrl } from "../../src/chrome/ensBrowsing/gateway";
import { buildHostedGatewayUrl as bannerGateway } from "../../src/chrome/ensBrowsing/banner/menuActions";
import { favoriteDappFaviconUrl } from "../../src/components/Dapp3Browser/dapp3BrowserModel";

const address = `0x${"12".repeat(20)}` as const;
const html = "<!doctype html><h1>GNS</h1>";

test("GNS accepts only explicit mainnet/Sepolia contract pointers", () => {
  for (const prefix of ["", "eth:", "sep:"])
    assert.deepEqual(parseGweiContentContract(prefix + address), {
      chainId: prefix === "sep:" ? 11155111 : 1,
      address,
    });
  for (const value of [
    "",
    `base:${address}`,
    `${address}/html`,
    "0x1234",
    `0x${"0".repeat(40)}`,
  ])
    assert.equal(parseGweiContentContract(value), null);
  assert.equal(
    buildHostedGatewayUrl("web3", "site.gwei", "/app", "?q=1", "#tab"),
    "https://site.gwei.domains/app?q=1#tab",
  );
  assert.equal(
    bannerGateway(
      {
        ensName: "site.gwei",
        kind: "web3",
        value: address,
        contractAddress: address,
        path: "/",
        trustedDirectly: true,
      },
      "/",
    ),
    "https://site.gwei.domains/",
  );
  assert.equal(
    favoriteDappFaviconUrl({
      ensName: "site.gwei",
      kind: "web3",
      path: "/",
      addedAt: 1,
    }),
    "https://site.gwei.domains/favicon.ico",
  );
});

test("GNS uses distinct manual calldata and 5219 request modes with bounded HTML", async () => {
  let mode = "manual";
  let status = 200;
  let body = html;
  let headers: [string, string][] = [["content-type", "text/html"]];
  const client = {
    getCode: async () => "0x6000",
    readContract: async (args: { functionName: string; args?: unknown }) => {
      if (args.functionName === "resolveMode")
        return stringToHex(mode, { size: 32 });
      assert.equal(args.functionName, "request");
      assert.deepEqual(args.args, [[], []]);
      return [status, body, headers];
    },
    call: async (args: unknown) => {
      assert.deepEqual(args, { to: address, data: "0x2f" });
      return {
        data: encodeAbiParameters([{ type: "bytes" }], [stringToHex(body)]),
      };
    },
  } as unknown as PublicClient;
  assert.equal(
    new TextDecoder().decode((await fetchGweiHtml(client, address)).body),
    html,
  );
  mode = "5219";
  assert.equal(
    new TextDecoder().decode((await fetchGweiHtml(client, address)).body),
    html,
  );
  for (const key of ["web3-next-chunk", "Content-Encoding"]) {
    headers = [[key, "value"]];
    await assert.rejects(fetchGweiHtml(client, address));
  }
  headers = [["content-type", "image/png"]];
  await assert.rejects(fetchGweiHtml(client, address));
  headers = [];
  status = 404;
  await assert.rejects(fetchGweiHtml(client, address));
  status = 200;
  for (const value of ["", "x".repeat(1024 * 1024 + 1)]) {
    body = value;
    await assert.rejects(fetchGweiHtml(client, address));
  }
  mode = "auto";
  await assert.rejects(fetchGweiHtml(client, address), /Unsupported/);
});

test("GNS keeps contenthash precedence and never falls back to the owner's address", async () => {
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalFetch = globalThis.fetch;
  let raw =
    `0x${encode("ipfs", "QmYwAPJzv5CZsnAzt8auVTL6yWKMpWvHVaHSiinRcW9pzZ").replace(/^0x/, "")}` as `0x${string}`;
  let record = `eth:${address}`;
  let textCalls = 0;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        sync: { get: async () => ({}) },
        local: { get: async () => ({}) },
      },
    },
  });
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    const selector = request.params[0].data.slice(0, 10);
    let result: string;
    if (selector === toFunctionSelector("contenthash(bytes32)"))
      result = encodeAbiParameters([{ type: "bytes" }], [raw]);
    else {
      assert.equal(selector, toFunctionSelector("text(bytes32,string)"));
      textCalls++;
      result = encodeAbiParameters([{ type: "string" }], [record]);
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
    );
  };
  try {
    const ipfs = await resolveGwei("site.gwei");
    assert.equal(ipfs.ok && ipfs.kind, "ipfs");
    assert.equal(textCalls, 0);
    raw = "0x";
    const web3 = await resolveGwei("site.gwei");
    assert.equal(web3.ok && web3.kind, "web3");
    assert.equal(web3.ok && web3.contractAddress, address);
    record = "";
    assert.equal((await resolveGwei("site.gwei")).ok, false);
    raw = "0xffff";
    const calls = textCalls;
    assert.equal((await resolveGwei("site.gwei")).ok, false);
    assert.equal(textCalls, calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalChrome)
      Object.defineProperty(globalThis, "chrome", originalChrome);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("GNS pins root HTML using the content chain RPC", async () => {
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalFetch = globalThis.fetch;
  const local: Record<string, unknown> = {
    ensBrowsing: { useLocalGateway: true, pinOnchainHtml: true },
  };
  const cid = "bafkreigh2akiscaildc5d4wjdfki7zf7ckqwcobthtxcu4bsmn5bgdmrze";
  const rpcUrls: string[] = [];
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        sync: {
          get: async () => ({
            networksInfo: {
              Sepolia: {
                chainId: 11155111,
                rpcUrl: "https://gns-sepolia.example/",
              },
            },
          }),
        },
        local: {
          get: async () => local,
          set: async (values: Record<string, unknown>) =>
            Object.assign(local, values),
        },
      },
    },
  });
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/api/v0/add?")) {
      assert.equal(
        await ((init?.body as FormData).get("file") as Blob).text(),
        html,
      );
      assert.equal(init?.credentials, "omit");
      return new Response(JSON.stringify({ Hash: cid }));
    }
    rpcUrls.push(String(url));
    const request = JSON.parse(String(init?.body));
    const selector =
      request.method === "eth_getCode"
        ? "code"
        : request.params[0].data.slice(0, 10);
    const result =
      selector === "code"
        ? "0x6000"
        : selector === toFunctionSelector("resolveMode()")
          ? encodeAbiParameters(
              [{ type: "bytes32" }],
              [stringToHex("manual", { size: 32 })],
            )
          : encodeAbiParameters([{ type: "bytes" }], [stringToHex(html)]);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
    );
  };
  try {
    const { resolveGweiContract } = await import(
      "../../src/chrome/ensBrowsing/gweiContract"
    );
    const client = {
      readContract: async () => `sep:${address}`,
    } as unknown as PublicClient;
    const result = await resolveGweiContract(client, "site.gwei");
    assert.equal(result.ok && result.value, cid);
    assert.equal(result.ok && result.contractAddress, address);
    assert.equal(rpcUrls.length, 3);
    assert.ok(rpcUrls.every((url) => url === "https://gns-sepolia.example/"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalChrome)
      Object.defineProperty(globalThis, "chrome", originalChrome);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("GNS options preserve the existing ENS request path", async () => {
  const { fetchErc4804 } = await import("../../src/chrome/ensBrowsing/web3url");
  const methods: string[] = [];
  const client = {
    getCode: async () => "0x6000",
    readContract: async ({ functionName }: { functionName: string }) => {
      methods.push(functionName);
      return functionName === "resolveMode"
        ? stringToHex("manual", { size: 32 })
        : [200, html, []];
    },
    call: async () => {
      throw new Error("legacy ENS path must not change");
    },
  } as unknown as PublicClient;
  assert.equal(
    new TextDecoder().decode((await fetchErc4804(client, address)).body),
    html,
  );
  assert.deepEqual(methods, ["resolveMode", "request"]);
});
