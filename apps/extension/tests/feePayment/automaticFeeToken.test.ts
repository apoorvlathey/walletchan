import assert from "node:assert/strict";
import test from "node:test";
import { automaticFeeToken } from "../../src/components/FeePayment/model/automaticFeeToken";
import { evaluateTokenFeePaymentEligibility } from "../../src/chrome/feePayment/capabilities";
import type { FeePaymentOption } from "../../src/chrome/feePayment/capabilities";
import { WALLETCHAN_OFFICIAL_DELEGATE } from "../../src/chrome/feePayment/constants";

const token = (balance: string | undefined, available = true): FeePaymentOption => ({
  id: "0x0000000000000000000000000000000000000001",
  symbol: "USDC", decimals: 6, balance, available,
});

test("low native balance selects any positive base-unit ERC20 balance in catalog order", () => {
  const funded = token("1");
  assert.equal(automaticFeeToken([
    { ...funded, id: "native" }, token("0"), token(undefined), funded,
    { ...funded, id: "0x0000000000000000000000000000000000000002" },
  ], true, false), funded.id);
});

test("zero, unknown, malformed, negative and unavailable balances keep the native warning", () => {
  for (const balance of [undefined, "", "0", "0x0", "-1", "invalid", "1.0"]) {
    assert.equal(automaticFeeToken([token(balance)], true, false), null);
  }
  assert.equal(automaticFeeToken([token("100", false)], true, false), null);
  assert.equal(automaticFeeToken([], true, false), null);
});

test("sufficient native balance and locked/force-inclusion reviews never switch", () => {
  assert.equal(automaticFeeToken([token("1")], false, false), null);
  assert.equal(automaticFeeToken([token("1")], true, true), null);
});

for (const accountType of ["privateKey", "seedPhrase", "bankr", "ledger", "impersonator"] as const) {
  test(`${accountType} automatic selection obeys background eligibility`, () => {
    for (const onchainDelegate of [null, WALLETCHAN_OFFICIAL_DELEGATE] as const) {
      const eligibility = evaluateTokenFeePaymentEligibility({
        accountType, chainId: 8453, hasDeployment: false, onchainDelegate,
      });
      const supported = accountType === "privateKey" || accountType === "seedPhrase" ||
        (accountType === "bankr" && onchainDelegate !== null);
      assert.equal(automaticFeeToken([{ ...token("1"), ...eligibility }], true, false),
        supported ? token("1").id : null);
    }
  });
}
