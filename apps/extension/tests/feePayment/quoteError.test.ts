import assert from "node:assert/strict";
import test from "node:test";
import { toFunctionSelector } from "viem";
import { feeQuoteErrorSummary, isTransactionSignatureExpired } from "../../src/components/FeePayment/model/quoteError";
const payload = '0xcd21db4f000000000000000000000000000000000000000000000000000000006aa0aa5e';
const error = `UserOperation reverted during simulation with reason: ${payload}`;
test('reported payload decodes as SignatureExpired with its independent onchain deadline', () => {
  assert.equal(toFunctionSelector('SignatureExpired(uint256)'), payload.slice(0, 10));
  assert.equal(new Date(Number(BigInt('0x' + payload.slice(10))) * 1000).toISOString(), '2026-09-09T00:37:50.000Z');
  assert.equal(isTransactionSignatureExpired(error), true);
  assert.equal(isTransactionSignatureExpired('USDC gas quote expired'), false);
  assert.equal(isTransactionSignatureExpired('reason: 0xcd21db4f'), false);
});
test('known expiry gives request-specific recovery while unknown diagnostics compact only hex', () => {
  assert.match(feeQuoteErrorSummary(error, true), /Refresh the swap/);
  assert.match(feeQuoteErrorSummary(error, false), /fresh transaction/);
  assert.equal(feeQuoteErrorSummary('Failed: 0x' + 'a'.repeat(512), false), 'Failed: [revert data]');
  assert.equal(feeQuoteErrorSummary('USDC gas quote timed out', false), 'USDC gas quote timed out');
});
