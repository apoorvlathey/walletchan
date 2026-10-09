import type { PortfolioResponse } from "@/chrome/portfolio/api";
import { previewAssets } from "./previewAssets";

export const previewPortfolioResponse: PortfolioResponse = {
  tokens: [
    {
      symbol: "ETH",
      name: "Ether",
      contractAddress: "native",
      chainId: 8453,
      decimals: 18,
      balance: "2.81226",
      balanceFormatted: "2.81226",
      priceUsd: 1749.69,
      valueUsd: 4920.58,
      logoUrl: previewAssets.chains.ethereum,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      chainId: 8453,
      decimals: 6,
      balance: "321.123",
      balanceFormatted: "321.123",
      priceUsd: 1,
      valueUsd: 321.123,
      logoUrl: previewAssets.tokens.usdc,
    },
  ],
  defiPositions: [],
  totalValueUsd: 5241.703,
};

export function getPreviewPortfolioResponse(scenario: string): PortfolioResponse {
  if (scenario === "portfolio-debt" || scenario === "portfolio-debt-only") {
    const debtOnly = scenario === "portfolio-debt-only";
    const asset = (symbol: string, balance: string, valueUsd: number, address: string) => ({
      symbol, name: symbol, chainId: 8453, contractAddress: address,
      balance, balanceFormatted: balance, valueUsd,
    });
    return {
      tokens: [],
      totalValueUsd: debtOnly ? -302.04 : 367.13,
      defiPositions: [{
        protocol: "Morpho", chainId: 8453, type: "lending", name: "wstETH / USDC",
        valueUsd: debtOnly ? -302.04 : 367.13,
        assets: debtOnly ? [] : [asset("wstETH", "0.2041", 669.17, "0x0000000000000000000000000000000000000001")],
        borrowAssets: [asset("USDC", "302.08", 302.04, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")],
        rewardAssets: [],
      }],
    };
  }
  if (scenario === "portfolio-empty" || scenario === "empty") {
    return { tokens: [], defiPositions: [], totalValueUsd: 0 };
  }
  if (scenario === "stress") {
    const stressTokens = Array.from({ length: 16 }, (_, index) => ({
      symbol: `ASSET${index + 1}`,
      name: `Institutional treasury settlement position ${index + 1}`,
      contractAddress: `0x${(index + 64).toString(16).padStart(40, "0")}`,
      chainId: 8453,
      decimals: 18,
      balance: `${987_654_321 - index * 12_345}.123456789`,
      balanceFormatted: `${987_654_321 - index * 12_345}.123456789`,
      priceUsd: 1 + index / 10,
      valueUsd: 987_654 - index * 12_345,
      logoUrl: index % 3 === 0 ? undefined : previewAssets.brand.walletChan,
    }));
    return {
      tokens: [...previewPortfolioResponse.tokens, ...stressTokens],
      defiPositions: [],
      totalValueUsd: stressTokens.reduce(
        (total, token) => total + token.valueUsd,
        previewPortfolioResponse.totalValueUsd,
      ),
    };
  }
  return previewPortfolioResponse;
}
