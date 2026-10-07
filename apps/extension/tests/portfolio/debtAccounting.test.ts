import assert from "node:assert/strict";
import test from "node:test";
import { normalizeZerionPositions } from "../../../website/app/api/portfolio/providers/zerionNormalizer";
import { boundPortfolioResponse } from "../../../website/app/api/portfolio/responsePolicy";
import { decodePortfolioResponse } from "../../src/chrome/portfolio/responsePolicy";
import { prunePortfolioHoldingsCacheValue, PORTFOLIO_HOLDINGS_CACHE_VERSION } from "../../src/chrome/portfolio/holdingsCachePolicy";
import { getChainTotals } from "../../src/components/Portfolio/Holdings/transforms";

const asset = { symbol: "USDC", name: "USDC", contractAddress: "0x0000000000000000000000000000000000000001", chainId: 8453, balance: "302.08", balanceFormatted: "302.08", valueUsd: 302.04, logoUrl: undefined };
const debtPosition = { protocol: "Morpho", chainId: 8453, type: "lending", name: "USDC", assets: [], rewardAssets: [], borrowAssets: [asset], valueUsd: -302.04 };

test("Zerion -> bounded response -> extension -> chain totals subtracts debt exactly once", () => {
  const raw = (side: string, value: number) => ({ id: side, attributes: { position_type: side, group_id: "morpho", protocol: "Morpho", value, quantity: { numeric: "1" }, fungible_info: { name: "USDC", symbol: "USDC", implementations: [{ chain_id: "base", address: asset.contractAddress }] } }, relationships: { chain: { data: { id: "base" } } } });
  const result = normalizeZerionPositions([raw("deposit", 669.17), raw("loan", 302.04)], new Map([["base", 8453]]));
  const bounded = boundPortfolioResponse(result.tokens, result.defiPositions);
  const totalValueUsd = result.defiPositions.reduce((sum, p) => sum + p.valueUsd, 0);
  const decoded = decodePortfolioResponse({ ...bounded, totalValueUsd });
  assert.ok(Math.abs(decoded.totalValueUsd - 367.13) < 1e-9);
  assert.ok(Math.abs(getChainTotals([], decoded.defiPositions).get(8453)! - 367.13) < 1e-9);
  assert.equal(decoded.defiPositions[0].borrowAssets?.[0].valueUsd, 302.04);
});

test("negative total and debt collection survive decoder, cache, and chain totals", () => {
  const decoded = decodePortfolioResponse({ tokens: [], defiPositions: [debtPosition], totalValueUsd: -302.04 });
  assert.equal(decoded.defiPositions[0].valueUsd, -302.04);
  assert.equal(decoded.totalValueUsd, -302.04);
  assert.equal(getChainTotals([], decoded.defiPositions).get(8453), -302.04);
  const snapshot = { ...decoded, timestamp: Date.now() };
  const old = prunePortfolioHoldingsCacheValue({ version: 3, entries: { wallet: snapshot } });
  assert.equal(old.next, undefined);
  assert.equal(prunePortfolioHoldingsCacheValue(old.next).changed, false);
  const current = prunePortfolioHoldingsCacheValue({ version: PORTFOLIO_HOLDINGS_CACHE_VERSION, entries: { wallet: snapshot } });
  assert.equal(current.next?.entries.wallet.totalValueUsd, -302.04);
  assert.deepEqual(current.next?.entries.wallet.defiPositions[0].borrowAssets, [asset]);
});

test("old supply responses, malformed debt, non-finite values and oversized collections are bounded", () => {
  const legacy = { ...debtPosition, assets: [asset], valueUsd: 302.04, borrowAssets: undefined };
  const decoded = decodePortfolioResponse({ tokens: [], defiPositions: [legacy], totalValueUsd: 302.04 });
  assert.deepEqual(decoded.defiPositions[0].borrowAssets, []);
  const malformed = { ...debtPosition, valueUsd: Infinity, borrowAssets: [{ ...asset, contractAddress: "bad" }] };
  const safe = decodePortfolioResponse({ tokens: [], defiPositions: [malformed], totalValueUsd: NaN });
  assert.equal(safe.defiPositions[0].valueUsd, 0);
  assert.deepEqual(safe.defiPositions[0].borrowAssets, []);
  assert.equal(safe.totalValueUsd, 0);
  const oversized = { ...debtPosition, borrowAssets: Array(75).fill(asset) };
  assert.equal(decodePortfolioResponse({ tokens: [], defiPositions: [oversized] }).defiPositions[0].borrowAssets?.length, 50);
  for (const totalValueUsd of [-1e100, 1e100]) {
    assert.equal(Math.abs(decodePortfolioResponse({ tokens: [], defiPositions: [], totalValueUsd }).totalValueUsd), 1e15);
  }
});
