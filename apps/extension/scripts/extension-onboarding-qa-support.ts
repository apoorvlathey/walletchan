import { privateKeyToAccount } from "viem/accounts";
import type { Page } from "@playwright/test";

interface QaOnboardingOptions {
  wallet: "bankr" | "privateKey" | "seedPhrase";
  password: string;
  privateKey: string;
  bankrApiKey: string;
}

/** Exercise the public onboarding UI in an isolated QA profile. */
export async function completeQaOnboarding(page: Page, options: QaOnboardingOptions): Promise<void> {
  const bankrAccount = privateKeyToAccount(options.privateKey as `0x${string}`);
  if (options.wallet === "bankr") {
    // Fulfill only the public ownership challenge. No real Bankr credential
    // or transaction submission is used by these isolated-profile checks.
    await page.context().route("https://api.bankr.bot/**", async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      const challenge = `WalletChan Bankr account verification:${bankrAccount.address.toLowerCase()}`;
      if (new URL(request.url()).pathname !== "/wallet/sign" ||
        body?.signatureType !== "personal_sign" || body?.message !== challenge) {
        await route.abort("blockedbyclient");
        return;
      }
      const signature = await bankrAccount.signMessage({ message: challenge });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        success: true, signature, signer: bankrAccount.address, signatureType: "personal_sign",
      }) });
    });
  }
  if (options.wallet === "seedPhrase") {
    await page.getByRole("button", { name: "Create new wallet", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Import or connect existing account", exact: true }).click();
    await page.getByRole("button", {
      name: options.wallet === "bankr" ? "Bankr API" : "Private Key", exact: true,
    }).click();
    if (options.wallet === "bankr") {
      await page.getByLabel("Bankr API key").fill(options.bankrApiKey);
      await page.getByLabel("Linked wallet address").fill(bankrAccount.address);
    } else {
      await page.getByLabel("Private key", { exact: true }).fill(options.privateKey);
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page.getByLabel("Password", { exact: true }).fill(options.password);
  await page.getByLabel("Confirm password").fill(options.password);
  await page.getByRole("button", { name: "Create wallet", exact: true }).click();
  await page.getByRole("heading", { name: "Your wallet is ready" }).waitFor({ timeout: 40_000 });
}
