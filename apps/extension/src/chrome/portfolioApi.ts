const PORTFOLIO_API_URL = "https://walletchan.com/api/portfolio";

export interface PortfolioToken {
  symbol: string;
  name: string;
  contractAddress: string;
  chainId: number;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
  logoUrl?: string;
}

export interface PortfolioResponse {
  tokens: PortfolioToken[];
  totalValueUsd: number;
}

export async function fetchPortfolio(
  address: string,
  signal?: AbortSignal,
): Promise<PortfolioResponse> {
  const url = `${PORTFOLIO_API_URL}?address=${encodeURIComponent(address)}`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portfolio fetch failed (${response.status}): ${text}`);
  }

  return response.json();
}
