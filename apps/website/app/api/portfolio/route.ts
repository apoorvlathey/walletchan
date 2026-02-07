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

    const params = new URLSearchParams({ addresses: address, includeImages: "true" });

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

    // Transform Octav response to provider-agnostic format
    // Octav structure: assetByProtocols -> protocol -> chains -> chain -> protocolPositions -> type -> assets[]
    const tokenMap = new Map<string, PortfolioToken>();
    const totalValueUsd = parseFloat(portfolio?.networth || "0");

    if (portfolio?.assetByProtocols) {
      for (const [, protocol] of Object.entries(portfolio.assetByProtocols)) {
        const proto = protocol as OctavProtocol;
        if (!proto.chains) continue;

        for (const [chainKey, chainData] of Object.entries(proto.chains)) {
          const chainId = getChainIdFromOctav(chainKey);
          if (!chainId) continue;

          const chain = chainData as OctavChain;
          if (!chain.protocolPositions) continue;

          for (const [, positionType] of Object.entries(chain.protocolPositions)) {
            const pos = positionType as OctavPositionType;
            // Collect assets from all position sub-types
            collectAssets(pos.assets, chainId, tokenMap);

            // Nested protocol positions (e.g. lending, LP)
            if (pos.protocolPositions) {
              for (const subPos of pos.protocolPositions) {
                collectAssets(subPos.assets, chainId, tokenMap);
                collectAssets(subPos.supplyAssets, chainId, tokenMap);
                collectAssets(subPos.rewardAssets, chainId, tokenMap);
                // borrowAssets are liabilities - skip them from holdings
              }
            }
          }
        }
      }
    }

    const tokens = Array.from(tokenMap.values());
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

// Octav API response types
interface OctavAsset {
  name: string;
  symbol: string;
  balance: string;
  price: string;
  value: string;
  contract?: string;
  decimal?: string;
  imgSmall?: string;
  imgLarge?: string;
}

interface OctavSubPosition {
  name: string;
  value: string;
  assets?: OctavAsset[];
  supplyAssets?: OctavAsset[];
  borrowAssets?: OctavAsset[];
  rewardAssets?: OctavAsset[];
}

interface OctavPositionType {
  name: string;
  value: string;
  assets?: OctavAsset[];
  protocolPositions?: OctavSubPosition[];
}

interface OctavChain {
  name: string;
  value: string;
  protocolPositions?: Record<string, OctavPositionType>;
}

interface OctavProtocol {
  name: string;
  value: string;
  imgSmall?: string;
  imgLarge?: string;
  chains?: Record<string, OctavChain>;
}

// Collect assets into a deduped token map (key: symbol+chainId)
function collectAssets(
  assets: OctavAsset[] | undefined,
  chainId: number,
  tokenMap: Map<string, PortfolioToken>
) {
  if (!assets) return;
  for (const asset of assets) {
    const valueUsd = parseFloat(asset.value || "0");
    const balance = parseFloat(asset.balance || "0");
    const priceUsd = parseFloat(asset.price || "0");
    if (balance === 0 && valueUsd === 0) continue;

    const key = `${asset.symbol}-${chainId}`;
    const existing = tokenMap.get(key);
    if (existing) {
      // Aggregate balances for the same token on the same chain
      const existingBal = parseFloat(existing.balance);
      const newBal = existingBal + balance;
      existing.balance = newBal.toString();
      existing.balanceFormatted = formatBalance(newBal);
      existing.valueUsd += valueUsd;
    } else {
      tokenMap.set(key, {
        symbol: asset.symbol || "???",
        name: asset.name || asset.symbol || "Unknown",
        contractAddress:
          !asset.contract || asset.contract === "0x0000000000000000000000000000000000000000"
            ? "native"
            : asset.contract,
        chainId,
        decimals: asset.decimal ? parseInt(asset.decimal, 10) : 18,
        balance: asset.balance || "0",
        balanceFormatted: formatBalance(balance),
        priceUsd,
        valueUsd,
        logoUrl: asset.imgSmall || asset.imgLarge || undefined,
      });
    }
  }
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

function formatBalance(balance: number | string | undefined): string {
  if (!balance) return "0";
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0";
  if (num < 0.000001) return "<0.000001";
  if (num < 1) return num.toPrecision(4);
  if (num < 1000) return num.toFixed(4);
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
