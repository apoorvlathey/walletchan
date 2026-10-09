import type { Page } from "@playwright/test";

/** Approve the isolated local QA origin through the actual connection screen. */
export async function connectQaDapp(dapp: Page, extensionId: string, stateKey: string): Promise<void> {
  const context = dapp.context();
  const before = new Set(context.pages());
  await dapp.waitForFunction((key) => Boolean((window as any)[key]?.provider), stateKey);
  await dapp.evaluate((key) => {
    const qa = (window as any)[key];
    void qa.provider.request({ method: "eth_requestAccounts" }).then((accounts: string[]) => {
      qa.address = accounts[0];
    });
  }, stateKey);
  const deadline = Date.now() + 20_000;
  let connection: Page | undefined;
  while (!connection && Date.now() < deadline) {
    connection = context.pages().find((page) =>
      !before.has(page) && page.url().startsWith(`chrome-extension://${extensionId}/index.html`));
    if (!connection) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!connection) throw new Error("QA site connection popup did not open");
  await connection.getByRole("heading", { name: "Connect site", exact: true }).waitFor();
  await connection.getByRole("button", { name: /^Connect(?: anyway)?$/, exact: true }).click();
  await dapp.waitForFunction((key) => Boolean((window as any)[key].address), stateKey);
  if (!connection.isClosed()) await connection.close();
}
