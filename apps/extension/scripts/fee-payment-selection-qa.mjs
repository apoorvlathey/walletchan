// Real React lifecycle regression checks without signing or network access.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: { resolveDir: extensionDir, loader: "tsx", contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useFeePaymentOptions } from './src/components/FeePayment/hooks/useFeePaymentOptions';
    window.requests = []; window.changes = [];
    window.chrome = { runtime: { sendMessage: (message, callback) => {
      window.requests.push({message, callback});
    } } };
    const root = createRoot(document.getElementById('root'));
    function Harness({ config }) {
      const [value, setValue] = useState('native');
      const [pending, setPending] = useState(true);
      const result = useFeePaymentOptions({
        ...config, value, onChange: token => { window.changes.push(token); setValue(token); },
        onOptionsLoadingChange: setPending,
      });
      window.manual = token => { result.markManualSelection(); setValue(token); };
      window.current = { value, pending, loading: result.loading, options: result.options };
      return <div>{value}</div>;
    }
    window.render = (config, key = 'same') => root.render(<Harness key={key} config={config}/>);
  ` },
  bundle: true, write: false, format: "iife", platform: "browser",
});
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage();
  const tokenId = "0x0000000000000000000000000000000000000001";
  const option = { id: tokenId, symbol: "USDC", decimals: 6, available: true, balance: "1" };
  const config = { txId: "one", chainId: 8453, nativeInsufficient: true, disabled: false };
  for (const requestKind of ["transaction", "batch", "crossDapp", "swap", "safe"]) {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(c => window.render(c), { ...config, requestKind });
    await page.waitForFunction(() => window.requests.length === 1);
    assert.equal(await page.evaluate(() => window.current.pending), true);
    await page.evaluate(o => window.requests[0].callback({ success: true, options: [o] }), option);
    await page.waitForFunction(id => window.current.value === id, tokenId);
    assert.equal(await page.evaluate(() => window.changes.length), 1);
    await page.evaluate(() => window.manual('native'));
    await page.waitForFunction(() => window.current.value === 'native' && !window.current.pending);
    assert.equal(await page.evaluate(() => window.changes.length), 1, 'manual native wins');
    // Executor/request changes must discard old options and stale callbacks.
    await page.evaluate(c => window.render(c, 'next'), { ...config, requestKind, txId: 'two' });
    await page.waitForFunction(() => window.requests.length === 2);
    await page.evaluate(c => window.render(c, 'next'), { ...config, requestKind, txId: 'three' });
    await page.waitForFunction(() => window.requests.length === 3);
    await page.evaluate(o => window.requests[1].callback({ success: true, options: [o] }), option);
    assert.equal(await page.evaluate(() => window.current.value), 'native');
    await page.evaluate(() => window.requests[2].callback({ success: true, options: [] }));
    await page.waitForFunction(() => !window.current.pending);
    assert.equal(await page.evaluate(() => window.current.value), 'native');
    // A new request after manual override is eligible again.
    await page.evaluate(c => window.render(c, 'next'), { ...config, requestKind, txId: 'four' });
    await page.waitForFunction(() => window.requests.length === 4);
    await page.evaluate(o => window.requests[3].callback({ success: true, options: [o] }), option);
    await page.waitForFunction(id => window.current.value === id, tokenId);
    console.log(requestKind + ': automatic selection, manual override, stale callback and request reset passed');
  }
  // Missing discovery callbacks must eventually release the native warning.
  await page.evaluate(c => window.render(c, 'timeout'), { ...config, requestKind: 'transaction', txId: 'timeout' });
  await page.waitForFunction(() => window.current.loading);
  await page.waitForFunction(() => !window.current.pending, undefined, { timeout: 12000 });
  assert.equal(await page.evaluate(() => window.current.value), 'native');
  console.log('Discovery timeout restores native warning');
} finally {
  await browser.close();
}
