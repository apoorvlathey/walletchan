import assert from "node:assert/strict";
import test from "node:test";
import { safePortfolioBalances } from "../../src/components/SafeAccount/portfolioBalances";
import type { DecodedPortfolioResponse } from "../../src/chrome/portfolio/api";

test("Safe balances include tokens, DeFi positions and truncated token totals per chain", () => {
  const portfolio = {
    tokens: [{ chainId: 1, valueUsd: 20 }, { chainId: 8453, valueUsd: 30 }],
    defiPositions: [{ chainId: 1, valueUsd: 5 }, { chainId: 8453, valueUsd: -2 }],
    omittedTokenValueUsdByChain: { "1": 10, "10": 7 },
  } as unknown as DecodedPortfolioResponse;
  assert.deepEqual(safePortfolioBalances(portfolio), { 1: 35, 8453: 28, 10: 7 });
});
test("Safe balances leave unrequested networks absent from the totals", () => {
  assert.deepEqual(safePortfolioBalances({ tokens: [], defiPositions: [], omittedTokenValueUsdByChain: {} }), {});
});

test("empty provider responses do not assert zero for a Safe's missing holdings", () => {
  assert.deepEqual(safePortfolioBalances({ tokens: [], defiPositions: [], omittedTokenValueUsdByChain: {} }), {});
});
