import assert from "node:assert/strict";
import test from "node:test";
import { normalizeZerionPositions } from "../app/api/portfolio/providers/zerionNormalizer";
import { octavProvider } from "../app/api/portfolio/providers/octav";
import { boundPortfolioResponse } from "../app/api/portfolio/responsePolicy";
import type { ZerionPosition } from "../app/api/portfolio/providers/zerionTypes";

function position(type: string, symbol: string, value: number, balance: string, chain = "base"): ZerionPosition {
  return {
    id: `${type}-${symbol}-${chain}`,
    attributes: {
      position_type: type, group_id: "market-1", protocol_module: "lending",
      protocol: "Morpho", value, quantity: { numeric: balance },
      fungible_info: { name: symbol, symbol, implementations: [{ chain_id: chain, address: "0x0000000000000000000000000000000000000001" }] },
    },
    relationships: { chain: { data: { id: chain } }, dapp: { data: { id: "morpho" } } },
  };
}
const chains = new Map([["base", 8453], ["ethereum", 1]]);

test("Morpho collateral minus loan/borrow debt survives the server boundary", () => {
  for (const side of ["loan", "borrow"]) for (const sign of [1, -1]) {
    const result = normalizeZerionPositions([
      position("deposit", "wstETH", 669.17, "0.2041"),
      position(side, "USDC", sign * 302.04, `${sign * 302.08}`),
    ], chains);
    const defi = result.defiPositions[0];
    assert.equal(defi.assets.length, 1);
    assert.equal(defi.borrowAssets?.length, 1);
    assert.equal(defi.borrowAssets?.[0].valueUsd, 302.04);
    assert.equal(defi.borrowAssets?.[0].balance, "302.08");
    assert.ok(Math.abs(defi.valueUsd - 367.13) < 1e-9);
    const bounded = boundPortfolioResponse(result.tokens, result.defiPositions);
    assert.deepEqual(bounded.defiPositions[0].borrowAssets, defi.borrowAssets);
    assert.equal(bounded.defiPositions[0].valueUsd, defi.valueUsd);
  }
});

test("supply, rewards, debt-only, and independent chains use signed net totals", () => {
  const result = normalizeZerionPositions([
    position("deposit", "ETH", 100, "1"), position("reward", "RWD", 5, "5"),
    position("loan", "USDC", 120, "120"), position("deposit", "ETH", 50, "0.5", "ethereum"),
  ], chains);
  assert.equal(result.defiPositions.find(p => p.chainId === 8453)?.valueUsd, -15);
  assert.equal(result.defiPositions.find(p => p.chainId === 1)?.valueUsd, 50);
  const supply = normalizeZerionPositions([position("deposit", "ETH", 100, "1")], chains);
  assert.equal(supply.defiPositions[0].valueUsd, 100);
  assert.deepEqual(supply.defiPositions[0].borrowAssets, []);
  const debt = normalizeZerionPositions([position("loan", "USDC", 302.04, "302.08")], chains);
  const bounded = boundPortfolioResponse([], debt.defiPositions);
  assert.equal(bounded.defiPositions[0].valueUsd, -302.04);
  assert.equal(bounded.defiPositions[0].assets.length, 0);
});

test("both boundaries cap borrowed asset arrays and preserve net position value", () => {
  const result = normalizeZerionPositions([position("loan", "USDC", 1, "1")], chains);
  const defi = { ...result.defiPositions[0], borrowAssets: Array(75).fill(result.defiPositions[0].borrowAssets![0]), valueUsd: -75 };
  const bounded = boundPortfolioResponse([], [defi]);
  assert.equal(bounded.defiPositions[0].borrowAssets?.length, 50);
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.defiPositions[0].valueUsd, -75);
});

test("Octav includes debt-only positions and subtracts borrowed magnitudes exactly once", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OCTAV_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OCTAV_API_KEY; else process.env.OCTAV_API_KEY = originalKey; });
  process.env.OCTAV_API_KEY = "test-only";
  const asset = (symbol: string, value: string, balance: string) => ({ name: symbol, symbol, value, balance, price: "1", contract: "0x0000000000000000000000000000000000000001" });
  globalThis.fetch = async () => new Response(JSON.stringify({ assetByProtocols: { morpho: { name: "Morpho", chains: { base: { protocolPositions: { lending: { name: "Lending", protocolPositions: [
    { name: "Collateral", supplyAssets: [asset("wstETH", "669.17", "0.2041")], borrowAssets: [asset("USDC", "-302.04", "-302.08")], rewardAssets: [] },
    { name: "Debt only", borrowAssets: [asset("USDC", "100", "100")] },
  ] } } } } } } }));
  const result = await octavProvider.fetch("0x0000000000000000000000000000000000000001", [8453]);
  assert.equal(result.defiPositions.length, 2);
  assert.ok(Math.abs(result.defiPositions[0].valueUsd - 367.13) < 1e-9);
  assert.equal(result.defiPositions[1].valueUsd, -100);
  assert.equal(result.defiPositions[0].borrowAssets?.[0].balance, "302.08");
});
