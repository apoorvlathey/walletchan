import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const ADDRESS = "0x1111111111111111111111111111111111111111";

test("reopened identities retain expired names and avatars during refresh", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const server = await createServer({
    root, configFile: false, logLevel: "error",
    resolve: { alias: { "@": path.join(root, "src") } },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "stale-identity-fixture",
      resolveId(id) { if (id === "/identity-fixture.js") return id; },
      load(id) {
        if (id !== "/identity-fixture.js") return;
        return `
          import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {useEnsIdentities} from '/src/hooks/useEnsIdentities.ts';
          const mode = new URLSearchParams(location.search).get('mode');
          window.cache = {'1:${ADDRESS}': {
            name:'cached.eth', avatar:'https://example.com/cached.png',
            resolvedAt: Date.now() - (mode === 'fresh' ? 1000 : 7*3600000),
            needsAvatar: mode === 'hint',
          }};
          window.chrome = {
            storage: {
              local: {get: async () => ({ensIdentityCache:window.cache})},
              onChanged: {addListener(){},removeListener(){}},
            },
            runtime: {sendMessage: async () => [], onMessage: {addListener(){},removeListener(){}}},
          };
          function App() {
            const value = useEnsIdentities(['${ADDRESS}']);
            window.result = {identity:value.identities.get('${ADDRESS}') ?? null, loading:value.isLoading};
            return React.createElement('pre',null,JSON.stringify(window.result));
          }
          createRoot(document.getElementById('root')).render(React.createElement(App));
        `;
      },
      transform(_source, id) {
        if (id.endsWith('/lib/ensIdentityCache.ts')) return `
          export const ensIdentityKey = (a,c) => c+':'+a;
          export const getEnsIdentityCache = async () => window.cache;
          export const isCacheValid = e => !e.needsAvatar && Date.now()-e.resolvedAt < 6*3600000;
          export const resolveAndCacheIdentity = async () => ({name:null,avatar:null});
          export const resolveAndCacheIdentities = () => new Promise((resolve,reject) => {
            window.finish = identity => resolve(new Map([['${ADDRESS}',identity]]));
            window.fail = () => reject(new Error('offline'));
          });
        `;
      },
      configureServer(instance) {
        instance.middlewares.use((req,res,next) => {
          if (!req.url?.startsWith('/identity-fixture?')) return next();
          res.setHeader('content-type','text/html');
          res.end('<div id="root"></div><script type="module" src="/identity-fixture.js"></script>');
        });
      },
    }],
  });
  await server.listen();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({headless:true,channel:"chrome"});
    const page = await browser.newPage();
    const {port} = server.httpServer!.address() as {port:number};
    const open = async (mode: string) => {
      await page.goto(`http://127.0.0.1:${port}/identity-fixture?mode=${mode}`);
      await page.waitForFunction(() => (window as any).result !== undefined);
    };
    const cached = {name:'cached.eth',avatar:'https://example.com/cached.png'};
    await open('fresh');
    await page.waitForFunction(() => (window as any).result.identity?.name === 'cached.eth');
    assert.equal(await page.evaluate(() => typeof (window as any).finish), 'undefined');

    await open('expired');
    await page.waitForFunction(() => (window as any).result.loading && (window as any).finish);
    assert.deepEqual(await page.evaluate(() => (window as any).result.identity), cached);
    const updated = {name:'updated.eth',avatar:'https://example.com/updated.png'};
    await page.evaluate(value => (window as any).finish(value), updated);
    await page.waitForFunction(() => !(window as any).result.loading);
    assert.deepEqual(await page.evaluate(() => (window as any).result.identity), updated);

    await open('expired');
    await page.waitForFunction(() => (window as any).fail);
    await page.evaluate(() => (window as any).fail());
    await page.waitForFunction(() => !(window as any).result.loading);
    assert.deepEqual(await page.evaluate(() => (window as any).result.identity), cached);

    await open('hint');
    await page.waitForFunction(() => (window as any).finish);
    assert.equal(await page.evaluate(() => (window as any).result.identity), null);

    await open('expired');
    await page.waitForFunction(() => (window as any).finish);
    await page.evaluate(() => (window as any).finish({name:null,avatar:null}));
    await page.waitForFunction(() => !(window as any).result.loading);
    assert.deepEqual(await page.evaluate(() => (window as any).result.identity), {name:null,avatar:null});
  } finally {
    await browser?.close();
    await server.close();
  }
});
