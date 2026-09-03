import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readComponent = (path: string) =>
  readFile(new URL(`../../src/components/${path}`, import.meta.url), "utf8");

test("transaction and signature request headings retain pinned chain context", async () => {
  const [single, batch, safe, signature, permission] = await Promise.all([
    readComponent("TransactionConfirmation/TransactionConfirmation.tsx"),
    readComponent("BatchConfirmation/BatchTransactionConfirmation.tsx"),
    readComponent("SafeApprovals/SafeProposalConfirmation.tsx"),
    readComponent("SignatureConfirmation/SignatureConfirmationScreen.tsx"),
    readComponent("Erc7715PermissionConfirmation/Erc7715PermissionScreen.tsx"),
  ]);

  assert.match(
    single,
    /contextHeaderAction=\{!showEstimatedChanges \? <RequestChainContext chainId=\{tx\.chainId\} chainName=\{resolvedChainName\}/u,
  );
  assert.match(
    batch,
    /<EstimatedChangesHeading[\s\S]*?chainId=\{chainId\}[\s\S]*?chainName=\{resolvedChainName\}/u,
  );
  assert.match(
    safe,
    /<EstimatedChangesHeading chainId=\{proposal\.chainId\} chainName=\{chainName\}/u,
  );
  assert.match(
    signature,
    /contextHeaderAction=\{[\s\S]*?<RequestChainContext chainId=\{chainId\} chainName=\{chainName\}/u,
  );
  assert.match(
    permission,
    /<RequestChainContext chainId=\{chainId\} chainName=\{chainName\}/u,
  );
});
