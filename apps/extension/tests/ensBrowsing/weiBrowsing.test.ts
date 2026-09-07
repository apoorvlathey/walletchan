import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAbiParameters,
  namehash,
  toFunctionSelector,
  type PublicClient,
} from "viem";
import { encode as encodeContenthash } from "@ensdomains/content-hash";
import {
  fetchWeiHtml,
  isWeiName,
  resolveWei,
} from "../../src/chrome/ensBrowsing/weiResolver";
import { buildHostedGatewayUrl } from "../../src/chrome/ensBrowsing/gateway";
import {
  hostedGatewayKind,
  prepareHostedGatewayNavigation,
} from "../../src/chrome/ensBrowsing/navigation";
import {
  installEthRedirectRule,
  installWeiGatewayRedirectRule,
  removeWeiGatewayBypassForTab,
} from "../../src/chrome/ensBrowsing/dnrRules";
import {
  parseDapp3Target,
  navigationUrlForTarget,
  favoriteDappFaviconUrl,
} from "../../src/components/Dapp3Browser/dapp3BrowserModel";
import { isAuthorizedEnsBrowsingSender } from "../../src/chrome/ensBrowsing/senderAuthorization";
import * as dnr from "../../src/chrome/ensBrowsing/dnrRules";
import { WEI_CONTRACT } from "../../src/utils/wei";

const address = `0x${"12".repeat(20)}` as const;
const cid = "QmYwAPJzv5CZsnAzt8auVTL6yWKMpWvHVaHSiinRcW9pzZ";

test("WNS names and gateway URLs retain namespace, path, query, and fragment", () => {
  for (const input of [
    "site.wei",
    "https://site.wei.limo",
    "https://site.wei.domains",
    "https://SITE.WEI.LIMO.",
  ]) {
    const target = parseDapp3Target(`${input}/app?q=1#tab`);
    assert.deepEqual(target, {
      kind: "ens",
      host: "site.wei",
      rest: "/app?q=1#tab",
    });
    assert.equal(
      navigationUrlForTarget(target!),
      "http://site.wei/app?q=1#tab",
    );
  }
  for (const name of [
    "wei",
    "site.wei.limo",
    "site.wei.attacker.example",
    "site..wei",
  ])
    assert.equal(isWeiName(name), false);
  assert.equal(isWeiName("Sub.Site.WEI."), true);
  for (const kind of ["ipfs", "ipns", "web3"] as const) {
    assert.equal(
      buildHostedGatewayUrl(kind, "site.wei", "/app", "?q=1", "#tab"),
      "https://site.wei.limo/app?q=1#tab",
    );
  }
  assert.equal(
    favoriteDappFaviconUrl({
      ensName: "site.wei",
      kind: "web3",
      path: "/",
      addedAt: 1,
    }),
    "https://site.wei.limo/favicon.ico",
  );
  assert.equal(
    hostedGatewayKind("https://site.wei.limo.attacker.example/"),
    null,
  );
  assert.equal(hostedGatewayKind("https://wei.limo/"), null);
});

test("WNS redirects enter the interstitial directly and hosted fallback installs a per-tab bypass", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const dynamic: chrome.declarativeNetRequest.Rule[] = [];
  let session: chrome.declarativeNetRequest.Rule[] = [];
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        getURL: (p: string) =>
          new URL(p, "chrome-extension://walletchan/").href,
      },
      declarativeNetRequest: {
        RuleActionType: { REDIRECT: "redirect", ALLOW: "allow" },
        ResourceType: { MAIN_FRAME: "main_frame" },
        updateDynamicRules: async (change: {
          addRules?: chrome.declarativeNetRequest.Rule[];
        }) => {
          dynamic.push(...(change.addRules ?? []));
        },
        getSessionRules: async () => session,
        updateSessionRules: async (change: {
          removeRuleIds: number[];
          addRules?: chrome.declarativeNetRequest.Rule[];
        }) => {
          session = session
            .filter((r) => !change.removeRuleIds.includes(r.id))
            .concat(change.addRules ?? []);
        },
      },
    },
  });
  try {
    await installEthRedirectRule();
    await installWeiGatewayRedirectRule();
    assert.match(
      "https://site.wei/app",
      new RegExp(dynamic[0].condition.regexFilter!),
    );
    const rule = dynamic[1];
    assert.equal(
      rule.action.redirect?.regexSubstitution,
      "chrome-extension://walletchan/interstitial.html#\\0",
    );
    for (const url of [
      "https://sub.site.wei.limo/app?q=1",
      "http://site.wei.domains/",
    ])
      assert.match(url, new RegExp(rule.condition.regexFilter!));
    for (const url of [
      "https://wei.limo/",
      "https://site.wei.limo.evil/",
      "https://site.wei.limo@evil/",
    ])
      assert.doesNotMatch(url, new RegExp(rule.condition.regexFilter!));
    for (const [install, id, url, substitution] of [
      [
        dnr.installEthGatewayRedirectRule,
        1002,
        "https://sub.site.eth.limo/app",
        "http://\\1.eth\\2",
      ],
      [
        dnr.installGweiDomainsRedirectRule,
        1009,
        "https://site.gwei.domains/app",
        "http://\\1.gwei\\2",
      ],
      [
        dnr.installW3ethRedirectRule,
        1004,
        "https://site.w3eth.io/app",
        "http://\\1.eth\\2",
      ],
      [
        dnr.installW3linkRedirectRule,
        1006,
        `https://${address}.1.w3link.io/`,
        "chrome-extension://walletchan/interstitial.html#\\0",
      ],
    ] as const) {
      await install();
      const legacy = dynamic.at(-1)!;
      assert.equal(legacy.id, id);
      assert.equal(legacy.action.redirect?.regexSubstitution, substitution);
      assert.match(url, new RegExp(legacy.condition.regexFilter!));
      assert.deepEqual(legacy.condition.resourceTypes, ["main_frame"]);
    }
    for (const [add, remove, id] of [
      [dnr.addEthGatewayBypassForTab, dnr.removeEthGatewayBypassForTab, 1003],
      [dnr.addGweiDomainsBypassForTab, dnr.removeGweiDomainsBypassForTab, 1010],
      [dnr.addW3ethBypassForTab, dnr.removeW3ethBypassForTab, 1005],
    ] as const) {
      await add(3);
      await add(3);
      assert.equal(session.length, 1);
      assert.equal(session[0].id, id);
      assert.deepEqual(session[0].condition.tabIds, [3]);
      await remove(3);
      assert.equal(session.length, 0);
    }
    await prepareHostedGatewayNavigation(7, "https://site.wei.limo/app");
    assert.deepEqual(session[0].condition.tabIds, [7]);
    assert.ok(session[0].priority! > rule.priority!);
    assert.equal(session[0].condition.regexFilter, rule.condition.regexFilter);
    await removeWeiGatewayBypassForTab(7);
    assert.equal(session.length, 0);
    for (const [url, allowed] of [
      ["https://site.wei.limo/", true],
      ["https://site.wei.limo.evil/", false],
    ] as const) {
      const sender = {
        url,
        frameId: 0,
        tab: { id: 7, url },
      } as chrome.runtime.MessageSender;
      assert.equal(
        isAuthorizedEnsBrowsingSender("ens-cache-metadata", sender),
        allowed,
      );
      assert.equal(isAuthorizedEnsBrowsingSender("ens-resolve", sender), false);
      assert.equal(
        isAuthorizedEnsBrowsingSender("ens-cache-metadata", {
          ...sender,
          frameId: 1,
        }),
        false,
      );
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "chrome", original);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("WNS reads its own registry and supports contenthash and bounded html() fallback", async () => {
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalFetch = globalThis.fetch;
  let raw =
    `0x${encodeContenthash("ipfs", cid).replace(/^0x/, "")}` as `0x${string}`;
  let resolved = address;
  const calls: string[] = [];
  let pinCount = 0;
  const settings = { useLocalGateway: false, pinOnchainHtml: false };
  const local: Record<string, unknown> = { ensBrowsing: settings };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        sync: { get: async () => ({}) },
        local: {
          get: async () => local,
          set: async (values: Record<string, unknown>) => {
            Object.assign(local, values);
          },
        },
      },
    },
  });
  globalThis.fetch = async (_input, init) => {
    if (String(_input).includes("/api/v0/add?")) {
      pinCount++;
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      const file = (init?.body as FormData).get("file") as Blob;
      assert.equal(await file.text(), "<!doctype html><h1>WNS</h1>");
      return new Response(JSON.stringify({ Hash: cid }));
    }
    const request = JSON.parse(String(init?.body));
    const tx = request.params[0];
    let result: string;
    if (request.method === "eth_getCode") result = "0x6000";
    else {
      calls.push(tx.data);
      const selector = tx.data.slice(0, 10);
      if (selector === toFunctionSelector("contenthash(bytes32)")) {
        assert.equal(tx.to.toLowerCase(), WEI_CONTRACT.toLowerCase());
        assert.equal(tx.data.slice(10), namehash("site.wei").slice(2));
        result = encodeAbiParameters([{ type: "bytes" }], [raw]);
      } else if (selector === toFunctionSelector("addr(bytes32)")) {
        assert.equal(tx.to.toLowerCase(), WEI_CONTRACT.toLowerCase());
        result = encodeAbiParameters([{ type: "address" }], [resolved]);
      } else {
        assert.equal(selector, toFunctionSelector("html()"));
        assert.equal(tx.to.toLowerCase(), address);
        result = encodeAbiParameters(
          [{ type: "string" }],
          ["<!doctype html><h1>WNS</h1>"],
        );
      }
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
    );
  };
  try {
    const ipfs = await resolveWei("SITE.WEI.");
    assert.equal(ipfs.ok && ipfs.kind, "ipfs");
    assert.equal(calls.length, 1);
    raw = "0x";
    assert.deepEqual(await resolveWei("site.wei"), {
      ok: true,
      kind: "web3",
      value: address,
      ensName: "site.wei",
      trustedDirectly: true,
      contractAddress: address,
    });
    settings.useLocalGateway = true;
    settings.pinOnchainHtml = true;
    const pinned = await resolveWei("site.wei");
    assert.ok(pinned.ok, JSON.stringify(pinned));
    assert.equal(pinned.ok && pinned.value, cid);
    assert.equal(pinned.ok && pinned.kind, "web3");
    assert.equal(pinCount, 1);
    assert.equal((await resolveWei("site.wei")).ok, true);
    assert.equal(pinCount, 1, "unchanged HTML reuses the existing pin");
    resolved = `0x${"00".repeat(20)}` as typeof address;
    assert.equal((await resolveWei("site.wei")).ok, false);
    const before = calls.length;
    assert.equal((await resolveWei("site.wei.evil")).ok, false);
    assert.equal(calls.length, before);
    for (const html of ["", "x".repeat(1024 * 1024 + 1)]) {
      const client = {
        getCode: async () => "0x6000",
        readContract: async () => html,
      } as unknown as PublicClient;
      await assert.rejects(fetchWeiHtml(client, address), /non-empty.*1 MiB/);
    }
    await assert.rejects(
      fetchWeiHtml(
        { getCode: async () => "0x" } as unknown as PublicClient,
        address,
      ),
      /not a contract/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalChrome)
      Object.defineProperty(globalThis, "chrome", originalChrome);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});
