import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  ACCOUNT_TYPE_CAPABILITIES,
  isDirectSigningAccount,
  isDirectSigningAccountType,
} from "../../src/chrome/accounts/accountTypePolicy";
import { isRequestSigningAccount } from "../../src/chrome/requests/pinnedRequest";
import { isSigningAccount } from "../../src/chrome/walletConnect/sessionPolicy";
import type { Account, AccountType } from "../../src/chrome/types";

test("direct-signer classification is shared by pending requests and WalletConnect", () => {
  assert.equal(isRequestSigningAccount, isDirectSigningAccount);
  assert.equal(isSigningAccount, isDirectSigningAccount);
  const expected = {
    bankr: true, privateKey: true, seedPhrase: true, ledger: true,
    impersonator: false, safe: false,
  } satisfies Record<AccountType, boolean>;
  assert.deepEqual(Object.keys(ACCOUNT_TYPE_CAPABILITIES).sort(), Object.keys(expected).sort());
  for (const [type, allowed] of Object.entries(expected)) {
    const account = { id: type, type, address: "0x1111111111111111111111111111111111111111", createdAt: 1 } as Account;
    assert.equal(isDirectSigningAccountType(type), allowed, type);
    assert.equal(isDirectSigningAccount(account), allowed, type);
  }
  assert.equal(isDirectSigningAccount(null), false);
  for (const invalid of [undefined, null, {}, 1, "trezor", "__proto__", "constructor", "toString"]) {
    assert.equal(isDirectSigningAccountType(invalid), false);
  }
});

test("adding an account type requires a capability row and updates derived signer types", async () => {
  const [types, policy] = await Promise.all([
    readFile(new URL("../../src/chrome/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/chrome/accounts/accountTypePolicy.ts", import.meta.url), "utf8"),
  ]);
  const directory = await mkdtemp(path.join(tmpdir(), "walletchan-account-types-"));
  const policyPath = path.join(directory, "accounts/accountTypePolicy.ts");
  const probePath = path.join(directory, "probe.ts");
  const options: ts.CompilerOptions = {
    noEmit: true, strict: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const diagnostics = () => ts.getPreEmitDiagnostics(ts.createProgram([policyPath, probePath], options));
  const messages = (errors: readonly ts.Diagnostic[]) => errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n");
  try {
    await mkdir(path.dirname(policyPath));
    await writeFile(path.join(directory, "types.ts"), types);
    await writeFile(policyPath, policy);
    await writeFile(probePath, "export {};\n");
    assert.equal(messages(diagnostics()), "", "the unmodified policy must compile");

    // Only the temporary copy changes; no Trezor support is added to production.
    const futureTypes = types.replace("export type AccountType =", 'export type AccountType =\n  | "trezor"');
    assert.notEqual(futureTypes, types);
    await writeFile(path.join(directory, "types.ts"), futureTypes);
    const missingRow = diagnostics();
    assert.ok(missingRow.some((error) => error.file?.fileName === policyPath && messages([error]).includes("trezor")), messages(missingRow));

    await writeFile(policyPath, policy.replace("export const ACCOUNT_TYPE_CAPABILITIES = {", "export const ACCOUNT_TYPE_CAPABILITIES = {\n  trezor: { directSigner: true },"));
    assert.ok(messages(diagnostics()).includes("forceInclusion"), "future types must explicitly decide force-inclusion capability");

    await writeFile(policyPath, policy.replace("export const ACCOUNT_TYPE_CAPABILITIES = {", "export const ACCOUNT_TYPE_CAPABILITIES = {\n  trezor: { directSigner: true, forceInclusion: false, forceInclusionBatch: false },"));
    await writeFile(probePath, 'import type { DirectSigningAccountType } from "./accounts/accountTypePolicy";\nconst signer: DirectSigningAccountType = "trezor";\n');
    assert.equal(messages(diagnostics()), "", "a declared future signer enters the derived type automatically");

    await writeFile(policyPath, policy.replace("export const ACCOUNT_TYPE_CAPABILITIES = {", "export const ACCOUNT_TYPE_CAPABILITIES = {\n  trezor: { directSigner: false, forceInclusion: false, forceInclusionBatch: false },"));
    assert.ok(diagnostics().some((error) => error.file?.fileName === probePath && error.code === 2322), "a non-signer must remain outside the derived signer type");

    const rawSource = await readFile(new URL("../../src/chrome/forceInclusion/rawSigner.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("rawSigner.ts", rawSource, ts.ScriptTarget.Latest, true);
    let dispatch: ts.SatisfiesExpression | undefined;
    ast.forEachChild((node) => {
      if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
        if (declaration.name.getText(ast) === "RAW_FORCE_INCLUSION_SIGNERS" && declaration.initializer && ts.isSatisfiesExpression(declaration.initializer)) dispatch = declaration.initializer;
      }
    });
    assert.ok(dispatch, "production dispatch must retain its satisfies check");
    assert.equal(dispatch.type.getText(ast), "SignerFactories");
    assert.match(rawSource, /\[Type in RawForceInclusionAccountType\]/);
    assert.ok(ts.isObjectLiteralExpression(dispatch.expression));
    const keys = dispatch.expression.properties.map((property) => property.name!.getText(ast));
    await writeFile(probePath, `import type { RawForceInclusionAccountType } from "./accounts/accountTypePolicy";\nconst dispatch = { ${keys.map((key) => `${key}: true`).join(", ")} } satisfies Record<RawForceInclusionAccountType, boolean>;\n`);
    assert.equal(messages(diagnostics()), "", "explicitly unsupported future account needs no raw signer");
    await writeFile(policyPath, policy.replace("export const ACCOUNT_TYPE_CAPABILITIES = {", "export const ACCOUNT_TYPE_CAPABILITIES = {\n  trezor: { directSigner: true, forceInclusion: \"raw\", forceInclusionBatch: false },"));
    assert.ok(messages(diagnostics()).includes("trezor"), "enabling a future raw signer must require a matching dispatch implementation");

  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
