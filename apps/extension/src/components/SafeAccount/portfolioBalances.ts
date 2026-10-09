import type { DecodedPortfolioResponse } from "@/chrome/portfolio/api";

export function safePortfolioBalances(portfolio: Pick<DecodedPortfolioResponse, "tokens" | "defiPositions" | "omittedTokenValueUsdByChain">): Record<number, number> {
  // No rows for a chain is not proof of zero: providers may omit holdings.
  const totals: Record<number, number> = {};
  for (const token of portfolio.tokens) totals[token.chainId] = (totals[token.chainId] || 0) + token.valueUsd;
  for (const position of portfolio.defiPositions) totals[position.chainId] = (totals[position.chainId] || 0) + position.valueUsd;
  for (const [chainId, value] of Object.entries(portfolio.omittedTokenValueUsdByChain)) {
    totals[Number(chainId)] = (totals[Number(chainId)] || 0) + value;
  }
  return totals;
}
