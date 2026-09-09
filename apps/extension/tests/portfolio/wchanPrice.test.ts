import assert from "node:assert/strict";
import test from "node:test";
import { DRIP_ADDRESSES } from "@walletchan/contract-addresses";
import { applyWchanPriceFallback as applyPortfolioFallback } from "../../src/chrome/portfolio/wchanPrice";

const applyWchanPriceFallback = async (tokens: Parameters<typeof applyPortfolioFallback>[0]) =>
  (await applyPortfolioFallback(tokens)).tokens;

const token = {
  symbol: "WCHAN", name: "WalletChan", chainId: 8453,
  contractAddress: DRIP_ADDRESSES[8453].wchan,
  decimals: 18, balance: "572264396.14", balanceFormatted: "572,264,396.14",
  priceUsd: 0, valueUsd: 0,
};

test("WCHAN fallback uses staking price and exact chain/address without replacing API prices", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  let calls = 0;
  let response: unknown = { success: true, priceUsd: 0.000001765 };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
    runtime: { async sendMessage(message: unknown) {
      calls++;
      assert.deepEqual(message, {
        type: "fetchTokenPrice", chainId: 8453,
        address: token.contractAddress.toLowerCase(),
      });
      if (response instanceof Error) throw response;
      return response;
    } },
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "chrome", original);
    else Reflect.deleteProperty(globalThis, "chrome");
  });

  const untouched = [
    { ...token, chainId: 1 },
    { ...token, contractAddress: "0x0000000000000000000000000000000000000001" },
    { ...token, priceUsd: 2, valueUsd: 10 },
    { ...token, balance: "0" },
  ];
  assert.equal(await applyWchanPriceFallback(untouched), untouched);
  assert.equal(calls, 0);
  const result = await applyWchanPriceFallback([
    { ...token, contractAddress: token.contractAddress.toUpperCase() }, ...untouched,
  ]);
  assert.equal(calls, 1);
  assert.equal(result[0].priceUsd, 0.000001765);
  assert.equal(result[0].valueUsd, Number(token.balance) * 0.000001765);
  assert.deepEqual(result.slice(1), untouched);
  assert.equal(token.valueUsd, 0);

  const position = {
    protocol: "Uniswap", chainId: 8453, type: "liquidity", name: "WCHAN / ETH",
    valueUsd: 50,
    assets: [token, { ...token, symbol: "ETH", contractAddress: "native", valueUsd: 50 }],
    rewardAssets: [{ ...token, balance: "100" }],
  };
  const beforePositionCalls = calls;
  const priced = await applyPortfolioFallback([], [position]);
  assert.equal(calls, beforePositionCalls + 1);
  assert.equal(priced.defiPositions[0].assets[0].valueUsd, Number(token.balance) * 0.000001765);
  assert.equal(priced.defiPositions[0].rewardAssets[0].valueUsd, 100 * 0.000001765);
  assert.equal(priced.defiPositions[0].valueUsd, 50 + Number(token.balance) * 0.000001765 + 100 * 0.000001765);
  assert.equal(priced.defiPositions[0].assets[1], position.assets[1]);
  assert.equal(position.valueUsd, 50);
  const afterPositionCalls = calls;
  assert.deepEqual(await applyPortfolioFallback([], priced.defiPositions), priced);
  assert.equal(calls, afterPositionCalls, "already priced positions must not be counted twice");
  await applyPortfolioFallback([token], [position]);
  assert.equal(calls, afterPositionCalls + 1, "holdings and positions share one lookup");
  const wrongChain = { ...position, chainId: 1 };
  const wrongAssetChain = { ...position, assets: [{ ...token, chainId: 1 }], rewardAssets: [] };
  const wrongAddress = { ...position, assets: [untouched[1]], rewardAssets: [] };
  const noBalance = { ...position, assets: [{ ...token, balance: "0" }], rewardAssets: [] };
  const ignored = [wrongChain, wrongAssetChain, wrongAddress, noBalance];
  assert.deepEqual((await applyPortfolioFallback([], ignored)).defiPositions, ignored);
  assert.equal(calls, afterPositionCalls + 1);

  for (const invalid of [0, -1, NaN, Infinity, "bad"]) {
    response = { success: true, priceUsd: invalid };
    assert.deepEqual(await applyWchanPriceFallback([token]), [token]);
    assert.deepEqual((await applyPortfolioFallback([], [position])).defiPositions, [position]);
  }
  for (const failure of [{ success: false, priceUsd: 1 }, undefined, new Error("offline")]) {
    response = failure;
    assert.deepEqual(await applyWchanPriceFallback([token]), [token]);
    assert.deepEqual((await applyPortfolioFallback([], [position])).defiPositions, [position]);
  }
});
