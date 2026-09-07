/** Run against `pnpm dev:preview`. Uses synthetic preview state; never signs or broadcasts. */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.env.PREVIEW_URL || "http://localhost:4317";
const output = await mkdtemp(path.join(os.tmpdir(), "walletchan-send-safety-"));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const reference = "0xb06a00000000000000000000000000000000dac2";
const suspicious = "0xb06a11111111111111111111111111111111dac2";
const other = "0xb06a22222222222222222222222222222222dac2";

async function openSend(wallet, theme) {
  const page = await browser.newPage({ viewport: { width: 360, height: 760 } });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on("pageerror", (error) => console.error(`${wallet}/${theme}: ${error.message}`));
  if (wallet === "ledger") {
    // The general preview registry predates Ledger. Mount the real Send component
    // with its actual Ledger prop using the same preview providers and transport.
    await page.route("**/src/preview/index.tsx*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOMClient from '/node_modules/.vite/deps/react-dom_client.js';
        import { ThemeProvider, SELECTED_THEME_STORAGE_KEY } from '/src/theme/index.ts';
        import { NetworksProvider } from '/src/contexts/NetworksContext.tsx';
        import { installPreviewChrome } from '/src/preview/previewChrome.ts';
        import { getPreviewWallet } from '/src/preview/fixtures.ts';
        import { previewPortfolioResponse } from '/src/preview/previewEnvironment.ts';
        import TokenTransfer from '/src/components/Transfer/TokenTransfer.tsx';
        import '/src/index.css';
        import '/src/preview/preview.css';
        installPreviewChrome();
        localStorage.setItem(SELECTED_THEME_STORAGE_KEY, '${theme}');
        await chrome.storage.local.set({ [SELECTED_THEME_STORAGE_KEY]: '${theme}' });
        document.body.classList.add('preview-canvas');
        const account = getPreviewWallet('privateKey');
        window.__sendSafetyQaWallet = 'ledger';
        ReactDOMClient.createRoot(document.getElementById('preview-root')).render(
          React.createElement(ThemeProvider, null,
            React.createElement(NetworksProvider, null,
              React.createElement(TokenTransfer, { token: previewPortfolioResponse.tokens[1],
                fromAddress: account.address, chainId: 8453, accountType: 'ledger',
                accounts: [], onBack() {}, onTransferInitiated() {} }))));
      `,
    }));
  }
  await page.goto(`${base}/preview/send?wallet=${wallet === "ledger" ? "privateKey" : wallet}&frame=popup&theme=${theme}&canvas=1`);
  await page.locator("#send-recipient").waitFor();
  if (wallet === "ledger") assert.equal(await page.evaluate(() => window.__sendSafetyQaWallet), "ledger");
  return page;
}

async function acknowledgeContractIfNeeded(page) {
  const consent = page.getByRole("checkbox", { name: "I understand the risk and want to continue", exact: true });
  if (await consent.count() && !await consent.isChecked()) {
    await page.getByText("I understand the risk and want to continue", { exact: true }).click();
  }
}

try {
  for (const wallet of ["privateKey", "seedPhrase", "bankr", "ledger"]) {
    for (const theme of ["midnight", "bauhaus"]) {
      const page = await openSend(wallet, theme);
      const input = page.locator("#send-recipient");
      const review = page.getByRole("button", { name: "Review send", exact: true });
      const checkbox = page.getByRole("checkbox", { name: "I checked the full address and want to continue" });
      await input.fill(suspicious);
      await page.locator("#send-amount").fill("1");
      await expect(page.getByText("Possible address poisoning", { exact: true })).toBeVisible();
      await expect(review).toBeDisabled();
      const warningBorder = await input.evaluate((element) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--chakra-colors-status-warning-emphasis)';
        element.parentElement.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      await expect(input).toHaveCSS('border-color', warningBorder);
      await input.fill('0x');
      await expect.poll(() => input.evaluate((element) => getComputedStyle(element).borderColor)).not.toBe(warningBorder);
      await input.fill(suspicious);
      await expect.poll(() => input.evaluate((element) => getComputedStyle(element).borderColor)).toBe(warningBorder);
      await expect(checkbox).not.toBeVisible();
      await expect(review.locator('svg')).toBeVisible();
      await page.locator('summary').filter({ hasText: 'Possible address poisoning' }).click();
      // Keyboard interaction checks the actual checkbox rather than its decorative control.
      await checkbox.focus();
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked();
      await acknowledgeContractIfNeeded(page);
      await expect(review).toBeEnabled({ timeout: 15000 });
      await input.fill(other);
      await page.locator("#send-amount").click();
      await expect(checkbox).not.toBeVisible();
      await page.locator('summary').filter({ hasText: 'Possible address poisoning' }).click();
      await expect(checkbox).not.toBeChecked();
      await expect(review).toBeDisabled();
      await input.fill(suspicious);
      await page.locator("#send-amount").click();
      await expect(checkbox).not.toBeVisible();
      await page.locator('summary').filter({ hasText: 'Possible address poisoning' }).click();
      await expect(checkbox).not.toBeChecked();
      await expect(review).toBeDisabled();
      await checkbox.focus();
      await page.screenshot({ path: path.join(output, `${wallet}-${theme}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await input.fill(reference);
      await page.locator("#send-amount").click();
      await expect(page.getByText("Possible address poisoning", { exact: true })).toHaveCount(0);
      await acknowledgeContractIfNeeded(page);
      await expect(review).toBeEnabled({ timeout: 15000 });
      console.log(`${wallet}/${theme}: warning, keyboard consent, A/B/A reset, exact match and overflow passed`);
      await page.close();
    }
  }

  const page = await openSend("privateKey", "midnight");
  const input = page.locator("#send-recipient");
  await input.fill(suspicious);
  await page.locator("#send-amount").fill("1");
  await expect(page.getByText("Possible address poisoning", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.recipientQa = { mode: "error", pending: [] };
    chrome.runtime.sendMessage = (message, ...args) => {
      if (message.type === "getSendRecipientReferences") {
        if (window.recipientQa.mode === "error") return Promise.reject(new Error("QA unavailable"));
        if (window.recipientQa.mode === "pending") return new Promise((resolve) => window.recipientQa.pending.push(resolve));
      }
      return original(message, ...args);
    };
  });
  await page.evaluate((address) => chrome.runtime.sendMessage({ type: "updateAddressContactLabel", address, label: "Treasury" }), reference);
  await expect(page.getByText("Recipient check unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review send", exact: true })).toBeDisabled();
  await page.evaluate(() => { window.recipientQa.mode = "pending"; });
  await page.getByRole("button", { name: "Retry check" }).click();
  await expect(page.getByText("Checking saved and previous recipients…")).toBeVisible();
  await page.evaluate(() => { window.recipientQa.mode = "ready"; });
  await page.evaluate((address) => chrome.runtime.sendMessage({ type: "updateAddressContactLabel", address, label: "Treasury restored" }), reference);
  await page.locator('summary').filter({ hasText: 'Possible address poisoning' }).click();
  await expect(page.getByText("Saved contact: Treasury restored", { exact: true })).toBeVisible();
  // Late success from the obsolete read must not remove the current warning.
  await page.evaluate(() => window.recipientQa.pending.forEach((resolve) => resolve({ success: true, references: [] })));
  await expect(page.getByText("Possible address poisoning", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review send", exact: true })).toBeDisabled();
  console.log("Unavailable/retry and stale response suppression passed");
  await page.close();
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
