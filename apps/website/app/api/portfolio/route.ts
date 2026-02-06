import { NextRequest, NextResponse } from "next/server";

const OCTAV_API_URL =
  process.env.OCTAV_API_URL || "https://api.octav.fi";
const OCTAV_API_KEY = process.env.OCTAV_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    if (!OCTAV_API_KEY) {
      return NextResponse.json(
        { error: "Portfolio API not configured" },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({ addresses: address });

    const response = await fetch(
      `${OCTAV_API_URL}/v1/portfolio?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OCTAV_API_KEY}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Portfolio API authentication failed" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Portfolio API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Octav returns an array; take first item
    const portfolio = Array.isArray(data) ? data[0] : data;

    // Transform to provider-agnostic format
    const tokens: PortfolioToken[] = [];
    let totalValueUsd = 0;

    if (portfolio?.chains) {
      for (const chain of portfolio.chains) {
        const chainId = getChainIdFromOctav(chain.chain);
        if (!chainId) continue;

        for (const token of chain.tokens || []) {
          const valueUsd = token.value_usd ?? 0;
          totalValueUsd += valueUsd;
          tokens.push({
            symbol: token.symbol || "???",
            name: token.name || token.symbol || "Unknown",
            contractAddress: token.address || "native",
            chainId,
            decimals: token.decimals ?? 18,
            balance: token.balance?.toString() || "0",
            balanceFormatted: token.balance_formatted?.toString() || formatBalance(token.balance, token.decimals),
            priceUsd: token.price_usd ?? 0,
            valueUsd,
            logoUrl: token.logo_url || token.icon_url || undefined,
          });
        }
      }
    }

    // Sort by USD value descending
    tokens.sort((a, b) => b.valueUsd - a.valueUsd);

    const result: PortfolioResponse = { tokens, totalValueUsd };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    console.error("Portfolio API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio data" },
      { status: 500 }
    );
  }
}

// Types
interface PortfolioToken {
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

interface PortfolioResponse {
  tokens: PortfolioToken[];
  totalValueUsd: number;
}

// Map Octav chain names to chain IDs
function getChainIdFromOctav(chain: string): number | null {
  const map: Record<string, number> = {
    ethereum: 1,
    eth: 1,
    base: 8453,
    polygon: 137,
    matic: 137,
    unichain: 130,
  };
  return map[chain?.toLowerCase()] ?? null;
}

function formatBalance(balance: number | string | undefined, decimals: number = 18): string {
  if (!balance) return "0";
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0";
  // Show up to 6 significant digits
  if (num < 0.000001) return "<0.000001";
  if (num < 1) return num.toPrecision(4);
  if (num < 1000) return num.toFixed(4);
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
