import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const ETH = "0x982bb9d000bfee18fd68c11505c11a4f900b2179";
const BASE = "0xccc850cd55d809c1330ceeb30ea630881cb5679a";

test("Send and identity hooks discard delayed results across network switches", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const cacheDir = await mkdtemp(path.join(tmpdir(), "walletchan-identity-vite-"));
  const server = await createServer({
    cacheDir,
    root, configFile: false, logLevel: "error",
    resolve: {alias: {"@": path.join(root, "src")}},
    server: {host: "127.0.0.1", port: 0},
    plugins: [{
      name: "ens-lifecycle-fixture",
      resolveId(id) { if (id === "/ens-lifecycle.js") return id; },
      load(id) {
        if (id !== "/ens-lifecycle.js") return;
        return `
          import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {useAddressResolver} from '/src/hooks/useAddressResolver.ts';
          import {useEnsIdentities} from '/src/hooks/useEnsIdentities.ts';
          window.pending = [];
          window.listeners = new Set();
          window.knownAccounts = [];
          window.chrome = {
            storage: {onChanged: {addListener(){}, removeListener(){}}},
            runtime: {
              sendMessage: async (message) => message.type === 'getAccounts' ? window.knownAccounts : [],
              onMessage: {addListener: (fn) => window.listeners.add(fn), removeListener: (fn) => window.listeners.delete(fn)},
            },
          };
          function App() {
            const [chain, setChain] = React.useState(1);
            window.setChain = setChain;
            const recipient = useAddressResolver('onshow.eth', 0, chain);
            const identity = useEnsIdentities(['${ETH}'], chain);
            window.result = {chain, recipient, name: identity.identities.get('${ETH}')?.name ?? null, avatar: identity.identities.get('${ETH}')?.avatar ?? null};
            return React.createElement('div', null, JSON.stringify(window.result));
          }
          createRoot(document.getElementById('root')).render(React.createElement(App));
        `;
      },
      transform(_source, id) {
        if (id.endsWith('/lib/ensUtils.ts')) return `
          export const isResolvableName = () => true;
          export const resolveNameToAddress = (name, chain) => new Promise(resolve => window.pending.push({kind:'forward',chain,resolve}));
          export const resolveAddressToName = async () => null;
          export const getNameAvatar = async () => null;
        `;
        if (id.endsWith('/lib/ensIdentityCache.ts')) return `
          export const ensIdentityKey = (a,c) => c+':'+a;
          export const getEnsIdentityCache = async () => ({});
          export const isCacheValid = () => false;
          export const resolveAndCacheIdentity = async () => ({name:null,avatar:null});
          export const resolveAndCacheIdentities = (addresses,chain) => new Promise(resolve => window.pending.push({kind:'identity',chain,resolve}));
        `;
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url !== '/ens-lifecycle') return next();
          res.setHeader('content-type', 'text/html');
          res.end('<div id="root"></div><script type="module" src="/ens-lifecycle.js"></script>');
        });
      },
    }],
  });
  await server.listen();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({headless:true, channel:"chrome"});
    const page = await browser.newPage();
    const address = server.httpServer!.address() as {port:number};
    await page.goto(`http://127.0.0.1:${address.port}/ens-lifecycle`);
    await page.waitForFunction(() => (window as any).pending?.length === 2);
    await page.evaluate(() => (window as any).setChain(8453));
    await page.waitForFunction(() => (window as any).pending?.length === 4);
    assert.equal(await page.evaluate(() => (window as any).result.recipient.isValid), false);
    await page.evaluate(({eth}) => {
      for (const request of (window as any).pending.filter((p:any) => p.chain === 1)) {
        request.resolve(request.kind === 'forward' ? eth : new Map([[eth, {name:'wrong-mainnet.eth',avatar:null}]]));
      }
    }, {eth:ETH});
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => (window as any).result.recipient.resolvedAddress), null);
    assert.equal(await page.evaluate(() => (window as any).result.name), null);
    await page.evaluate(({eth,base}) => {
      for (const request of (window as any).pending.filter((p:any) => p.chain === 8453)) {
        request.resolve(request.kind === 'forward' ? base : new Map([[eth, {name:null,avatar:null}]]));
      }
    }, {eth:ETH,base:BASE});
    await page.waitForFunction((base) => (window as any).result.recipient.resolvedAddress === base, BASE);
    assert.equal(await page.evaluate(() => (window as any).result.recipient.isValid), true);
    // A known account must switch to its established mainnet identity even on Base.
    await page.evaluate((eth) => {
      (window as any).knownAccounts = [{address:eth}];
      for (const listener of (window as any).listeners) listener({type:'accountsUpdated'});
    }, ETH);
    await page.waitForFunction(() => (window as any).pending.filter((p:any) => p.kind === 'identity' && p.chain === 1).length === 2);
    await page.evaluate((eth) => {
      const requests = (window as any).pending.filter((p:any) => p.kind === 'identity' && p.chain === 1);
      requests.at(-1).resolve(new Map([[eth, {name:'walletchan.eth',avatar:'mainnet-avatar'}]]));
    }, ETH);
    await page.waitForFunction(() => (window as any).result.name === 'walletchan.eth');
    assert.equal(await page.evaluate(() => (window as any).result.avatar), 'mainnet-avatar');
    // Removing the account but retaining a saved contact must retain that profile.
    await page.evaluate((eth) => {
      (window as any).knownAccounts = [];
      for (const listener of (window as any).listeners) {
        listener({type:'addressContactsUpdated', contacts:[{address:eth,label:'Saved wallet'}]});
        listener({type:'accountsUpdated'});
      }
    }, ETH);
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => (window as any).result.name), 'walletchan.eth');
    await page.evaluate(() => (window as any).setChain(1));
    await page.waitForFunction(() => (window as any).result.chain === 1);
    assert.equal(await page.evaluate(() => (window as any).result.recipient.isValid), false);
    assert.equal(await page.evaluate(() => (window as any).result.recipient.resolvedAddress), null);
    assert.equal(await page.evaluate(() => (window as any).result.name), "walletchan.eth");
  } finally { await browser?.close(); await server.close(); await rm(cacheDir, {recursive:true,force:true}); }
});
