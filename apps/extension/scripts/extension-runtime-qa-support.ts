import { completeQaOnboarding } from "./extension-onboarding-qa-support";
import { type BrowserContext, type Page, type Worker } from "@playwright/test";
import { createServer, type Server } from "node:http";

export type WalletType = "bankr" | "privateKey" | "seedPhrase";

const PASSWORD = "walletchan-qa-password";
const TEST_PRIVATE_KEY = `0x${"11".repeat(32)}`;

const DAPP_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>WalletChan runtime QA dapp</title>
  </head>
  <body>
    <main><h1>WalletChan runtime QA dapp</h1></main>
    <script>
      window.__walletQa = { provider: null, status: "booting", settlements: 0 };
      window.addEventListener("eip6963:announceProvider", (event) => {
        if (event.detail && event.detail.info && event.detail.info.rdns === "com.walletchan") {
          window.__walletQa.provider = event.detail.provider;
          if (window.__walletQa.status === "booting") window.__walletQa.status = "ready";
        }
      });
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      setInterval(() => {
        if (!window.__walletQa.provider && window.ethereum) {
          window.__walletQa.provider = window.ethereum;
          window.__walletQa.status = "ready";
        }
        window.dispatchEvent(new Event("eip6963:requestProvider"));
      }, 100);
    </script>
  </body>
</html>`;

export function startDappServer(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    if (request.url === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(DAPP_HTML);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine QA dapp port"));
        return;
      }
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

export async function waitForExtensionWorker(
  context: BrowserContext,
): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing || context.waitForEvent("serviceworker", { timeout: 20_000 });
}

export function observePage(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/failed to load resource|net::ERR_ABORTED/i.test(value)) return;
    errors.push(`${page.url()}: ${value}`);
  });
}

export async function getOnboardingPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const onboardingUrl = `chrome-extension://${extensionId}/onboarding.html`;
  const existing = context.pages().find((page) => page.url().startsWith(onboardingUrl));
  const page = existing || context.pages()[0] || (await context.newPage());
  await page.goto(onboardingUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create new wallet" }).waitFor();
  return page;
}

export async function completeOnboarding(
  page: Page,
  wallet: WalletType,
): Promise<void> {
  await completeQaOnboarding(page, {
    wallet, password: PASSWORD, privateKey: TEST_PRIVATE_KEY,
    bankrApiKey: "walletchan-runtime-qa-key",
  });

  const modeResult = await page.evaluate(() =>
    chrome.runtime.sendMessage({ type: "setSidePanelMode", enabled: false }),
  );
  if (modeResult?.success !== true) {
    throw new Error("Could not switch the runtime QA profile to popup mode");
  }
}

export async function inspectSurface(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const rootWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    );
    if (rootWidth > window.innerWidth + 1) {
      failures.push(`${rootWidth - window.innerWidth}px horizontal overflow`);
    }
    const broken = [...document.images].filter(
      (image) => image.src && image.complete && image.naturalWidth === 0,
    );
    if (broken.length) failures.push(`${broken.length} broken image(s)`);
    return failures;
  });
}
