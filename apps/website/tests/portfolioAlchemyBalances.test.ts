import assert from "node:assert/strict";
import test from "node:test";
import { PORTFOLIO_CHAINS } from "../app/api/portfolio/chains";
import { alchemyProvider } from "../app/api/portfolio/providers/alchemy";

test("Alchemy raw hex balances retain native and ERC-20 holdings with their decimal precision", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ data: { tokens: [
    { network: "base-mainnet", tokenAddress: null, tokenBalance: "0x16345785d8a0000", tokenMetadata: { decimals: 18, symbol: "ETH" }, tokenPrices: [{ currency: "usd", value: "3000" }] },
    { network: "base-mainnet", tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", tokenBalance: "0x2625a0", tokenMetadata: { decimals: 6, symbol: "USDC" }, tokenPrices: [{ currency: "eur", value: "0.9" }, { currency: "usd", value: "1" }] },
    { network: "base-mainnet", tokenAddress: "0x0000000000000000000000000000000000000001", tokenBalance: "0x0", tokenMetadata: { decimals: 18 } },
  ] } })) as typeof fetch;
  try {
    const result = await alchemyProvider.fetch("0x3a11e7c2ccd1af51c1edd664800af20d21ee5d34", [8453]);
    assert.equal(result.tokens.length, 2);
    assert.equal(result.tokens[0].balance, "0.1");
    assert.equal(result.tokens[0].valueUsd, 300);
    assert.equal(result.tokens[1].balance, "2.5");
    assert.equal(result.tokens[1].valueUsd, 2.5);
  } finally { globalThis.fetch = originalFetch; }
});
test("malformed Alchemy balance data fails instead of reporting empty holdings", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ data: { tokens: [{ network: "base-mainnet", tokenBalance: "bad-data", tokenMetadata: { decimals: 18 } }] } })) as typeof fetch;
  try {
    await assert.rejects(alchemyProvider.fetch("0x1111111111111111111111111111111111111111", [8453]), /invalid token balance/);
  } finally { globalThis.fetch = originalFetch; }
});

test("native holdings without provider metadata use each network's native currency", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ data: { tokens: [
    ...PORTFOLIO_CHAINS.map((chain, index) => ({
      network: chain.alchemyNetwork,
      tokenAddress: [null, "0x0000000000000000000000000000000000000000", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"][index % 3],
      tokenBalance: "0x16345785d8a0000",
      tokenMetadata: { name: null, symbol: null, decimals: null },
    })),
    { network: "base-mainnet", tokenAddress: "0x0000000000000000000000000000000000000001", tokenBalance: "0x1" },
  ] } })) as typeof fetch;
  try {
    const result = await alchemyProvider.fetch("0x1111111111111111111111111111111111111111", PORTFOLIO_CHAINS.map((chain) => chain.chainId));
    for (const [index, chain] of PORTFOLIO_CHAINS.entries()) {
      const token = result.tokens[index];
      assert.equal(token.symbol, chain.nativeCurrency.symbol);
      assert.equal(token.name, chain.nativeCurrency.name);
      assert.equal(token.decimals, chain.nativeCurrency.decimals);
      assert.equal(token.contractAddress, "native");
      assert.equal(token.balance, "0.1");
    }
    assert.equal(result.tokens.at(-1)?.symbol, "???", "unknown ERC-20 must not inherit ETH metadata");
  } finally { globalThis.fetch = originalFetch; }
});
