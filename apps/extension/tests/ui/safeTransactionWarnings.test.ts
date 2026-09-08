import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeTransactionWarnings } from "../../src/components/SafeReview/SafeTransactionWarnings";
import { buildSafeTransactionTypedData } from "../../src/chrome/safe/transactionHash";

const zero = "0x0000000000000000000000000000000000000000" as const;
const other = "0x1111111111111111111111111111111111111111" as const;
const transaction = { to: other, value: "0", data: "0x", operation: 0,
  safeTxGas: "0", baseGas: "21000", gasPrice: "1", gasToken: zero,
  refundReceiver: zero, nonce: 0 } as const;
function render(tx: unknown) {
  return renderToStaticMarkup(createElement(SafeTransactionWarnings, {
    transaction: tx, chainId: 1,
  }, createElement("span", null, "Reviewed call content")));
}

test("refund disclosure shows effective recipient and payment asset without estimates", () => {
  const html = render(transaction);
  assert.match(html, /Gas reimbursement enabled/);
  assert.match(html, /Native currency/);
  assert.match(html, /Transaction submitter/);
  assert.match(html, /Payment details/);
  assert.doesNotMatch(html, /Delegatecall can change/);
  assert.match(html, /Reviewed call content/);
  const tokenHtml = render({ ...transaction, gasToken: other, refundReceiver: other });
  assert.equal(tokenHtml.split(other).length - 1, 2);
  assert.doesNotMatch(tokenHtml, /Transaction submitter|Native currency/);
});

test("changing reviewed data clears obsolete warnings and preserves nested review content", () => {
  const both = render({ ...transaction, operation: 1 });
  assert.match(both, /Delegatecall can change your Safe/);
  assert.match(both, /Gas reimbursement enabled/);
  assert.ok(both.indexOf("Gas reimbursement enabled") < both.indexOf("Reviewed call content"));
  const clean = render({ ...transaction, gasPrice: "0x0" });
  assert.doesNotMatch(clean, /Gas reimbursement enabled|Delegatecall can change/);
  assert.match(clean, /Reviewed call content/);
});

test("external typed data displays both warnings without changing the supplied payload", () => {
  const typedData = buildSafeTransactionTypedData({ chainId: 1, safeAddress: other,
    safeVersion: "1.4.1", transaction: { ...transaction, operation: 1 } });
  const before = JSON.stringify(typedData);
  const html = renderToStaticMarkup(createElement(SafeTransactionWarnings, { typedData, chainId: 1 }));
  assert.match(html, /Gas reimbursement enabled/);
  assert.match(html, /Delegatecall can change your Safe/);
  assert.equal(JSON.stringify(typedData), before);
});

test("Safe warnings surround all signature display branches and all proposal lifecycle states", async () => {
  const source = await readFile(new URL("../../src/components/SignatureConfirmation/SignatureRequestConfirmation.tsx", import.meta.url), "utf8");
  assert.match(source, /actionNotice=\{<VStack[\s\S]*?<SafeRiskDecision/);
  assert.match(source, /isRejecting \|\| safeDecision.blocked/);
  assert.match(source, /if \(!canSign \|\| safeDecision.blocked/);
  assert.match(source, /readableDetails=\{readableDetails\}/);
  const proposal = await readFile(new URL("../../src/components/SafeApprovals/SafeProposalConfirmation.tsx", import.meta.url), "utf8");
  assert.match(proposal, /actionNotice=[\s\S]*?<SafeRiskDecision/);
  assert.match(proposal, /safeRiskDecision.blocked/);
  const impact = await readFile(new URL("../../src/components/SafeApprovals/SafeProposalFinancialImpact.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(impact, /No Safe asset changes/);
  assert.match(impact, /No transfer in the rejection call/);
});
