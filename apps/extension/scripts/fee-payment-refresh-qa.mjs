// Fake clock + real React lifecycle; mocked Chrome transport never signs or submits.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const tokenId = "0x0000000000000000000000000000000000000001";
const bundle = await build({
  stdin: { resolveDir: extensionDir, loader: "tsx", contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useFeePaymentQuote } from './src/components/FeePayment/hooks/useFeePaymentQuote';
    const tokenId = '${tokenId}';
    const options = [{ id: tokenId, symbol: 'USDC', available: true, balance: '100', decimals: 6 }];
    window.requests = []; window.released = [];
    window.chrome = { runtime: { sendMessage: (message, callback) => window.requests.push({ message, callback }) } };
    window.makeQuote = id => ({
      success: true, quoteId: id, tokenId, tokenAddress: tokenId,
      tokenSymbol: 'USDC', tokenDecimals: 6, tokenStablecoin: true,
      maximumTokenCost: '10', tokenBalance: '100', expiresAt: Date.now() + 45000,
      approvalAdded: false, approvalAmount: null, paymaster: tokenId,
      userOperationNonce: '0x0', sufficientBalance: true, needsAuthorization: false,
    });
    function Harness({ kind }) {
      const [quote, setQuote] = useState(window.makeQuote('initial'));
      const [disabled, setDisabled] = useState(false);
      const [identity, setIdentity] = useState('request-one');
      const onQuoteChange = React.useCallback(q => { window.released.push(q); setQuote(q); }, []);
      const result = useFeePaymentQuote({ requestIdentity: identity, txId: identity,
        requestKind: kind, value: tokenId, quote, options, disabled, onQuoteChange });
      window.current = { quote, error: result.quoteError, loading: result.quoteLoading };
      window.retry = () => result.requestQuote();
      window.lock = setDisabled;
      window.changeRequest = () => { setIdentity('request-two'); setQuote(null); };
      window.native = () => { result.resetQuoteState(); setDisabled(true); setQuote(null); };
      return <div>{quote?.quoteId || 'none'} {result.quoteError}</div>;
    }
    window.mount = kind => createRoot(document.getElementById('root')).render(<Harness kind={kind}/>);
  ` },
  bundle: true, write: false, format: "iife", platform: "browser",
});
const browser = await chromium.launch({ headless: true, channel: "chrome" });
async function setup(kind = 'transaction') {
  const page = await browser.newPage();
  await page.clock.install({ time: new Date('2026-09-09T00:00:00Z') });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(k => window.mount(k), kind);
  await page.waitForFunction(() => window.current?.quote?.quoteId === 'initial');
  return page;
}
async function reply(page, index, id) {
  await page.evaluate(({ index, id }) => window.requests[index].callback(window.makeQuote(id)), { index, id });
  await page.waitForFunction(id => window.current.quote?.quoteId === id && !window.current.loading, id);
}
async function requestCount(page, count) {
  await page.waitForFunction(n => window.requests.length === n, count);
}
try {
  for (const kind of ['transaction', 'batch', 'crossDapp', 'swap', 'safe']) {
    const page = await setup(kind);
    for (let i = 0; i < 5; i++) {
      await page.clock.runFor(30000);
      await requestCount(page, i + 1);
      assert.equal(await page.evaluate(() => window.current.error), '');
      assert.ok(await page.evaluate(() => window.current.quote?.quoteId), 'keep valid quote during refresh');
      await reply(page, i, 'auto-' + i);
    }
    assert.equal(await page.evaluate(() => window.released.some(q => q === null)), false, 'successful refresh never clears parent quote');
    await page.clock.runFor(45000);
    await page.waitForFunction(() => window.current.error.includes('expired'));
    assert.equal(await page.evaluate(() => window.requests.length), 5);
    assert.equal(await page.evaluate(() => window.current.quote), null);
    await page.clock.runFor(180000);
    assert.equal(await page.evaluate(() => window.requests.length), 5, 'no polling after cap');
    await page.evaluate(() => window.retry());
    await requestCount(page, 6);
    await reply(page, 5, 'manual');
    for (let i = 0; i < 5; i++) {
      await page.clock.runFor(30000);
      await requestCount(page, i + 7);
      await reply(page, i + 6, 'reset-auto-' + i);
    }
    await page.clock.runFor(45000);
    await page.waitForFunction(() => window.current.error.includes('expired'));
    assert.equal(await page.evaluate(() => window.requests.length), 11);
    console.log(kind + ': five quiet refreshes, cap, idle stop, Retry and five renewed refreshes passed');
    await page.close();
  }
  {
    const page = await setup();
    await page.clock.runFor(30000);
    await requestCount(page, 1);
    await page.clock.runFor(15000);
    await page.waitForFunction(() => window.current.quote === null);
    assert.equal(await page.evaluate(() => window.current.error), '', 'slow refresh does not flash expiry error');
    await reply(page, 0, 'slow');
    await page.clock.runFor(30000);
    await requestCount(page, 2);
    await page.clock.runFor(31000);
    await page.waitForFunction(() => window.current.error.includes('timed out'));
    await page.evaluate(() => window.requests[1].callback(window.makeQuote('late')));
    assert.equal(await page.evaluate(() => window.current.quote), null, 'ignore timed out response');
    await page.clock.runFor(180000);
    assert.equal(await page.evaluate(() => window.requests.length), 2);
    console.log('Slow response: expiry safely pauses confirmation, timeout stops requests, late response ignored');
    await page.close();
  }
  {
    const page = await setup();
    await page.clock.runFor(30000);
    await requestCount(page, 1);
    await page.evaluate(() => window.requests[0].callback({ success: false, error: 'Provider unavailable' }));
    await page.waitForFunction(() => window.current.error === 'Provider unavailable');
    assert.equal(await page.evaluate(() => window.current.quote.quoteId), 'initial');
    await page.clock.runFor(180000);
    assert.equal(await page.evaluate(() => window.requests.length), 1, 'failed refresh requires manual Retry');
    assert.equal(await page.evaluate(() => window.current.quote), null);
    console.log('Provider failure preserves unexpired quote, expires safely and never retries automatically');
    await page.close();
  }
  {
    const page = await setup('swap');
    await page.clock.runFor(30000);
    await requestCount(page, 1);
    await page.evaluate(() => window.requests[0].callback({ success: false,
      error: 'UserOperation reverted during simulation with reason: 0xcd21db4f000000000000000000000000000000000000000000000000000000006aa0aa5e' }));
    await page.waitForFunction(() => window.current.error.includes('0xcd21db4f'));
    assert.equal(await page.evaluate(() => window.current.quote), null,
      'onchain signature expiry invalidates even the still-unexpired fee quote');
    await page.clock.runFor(180000);
    assert.equal(await page.evaluate(() => window.requests.length), 1);
    console.log('SignatureExpired invalidates the old quote immediately and stops automatic retries');
    await page.close();
  }
  {
    const page = await setup();
    await page.evaluate(() => window.lock(true));
    await page.clock.runFor(60000);
    assert.equal(await page.evaluate(() => window.requests.length), 0);
    await page.evaluate(() => window.lock(false));
    await page.clock.runFor(1);
    await requestCount(page, 1);
    await page.evaluate(() => window.changeRequest());
    await requestCount(page, 2);
    await page.evaluate(() => window.requests[0].callback(window.makeQuote('stale')));
    assert.notEqual(await page.evaluate(() => window.current.quote?.quoteId), 'stale');
    await reply(page, 1, 'new-request');
    await page.clock.runFor(30000);
    await requestCount(page, 3);
    await page.evaluate(() => window.native());
    await page.evaluate(() => window.requests[2].callback(window.makeQuote('cancelled')));
    assert.equal(await page.evaluate(() => window.current.quote), null);
    await page.clock.runFor(180000);
    assert.equal(await page.evaluate(() => window.requests.length), 3);
    console.log('Submission lock, suspended expiry, request changes and native cancellation passed');
    await page.close();
  }
} finally {
  await browser.close();
}
