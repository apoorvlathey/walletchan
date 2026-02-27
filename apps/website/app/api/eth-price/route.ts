import { NextResponse } from "next/server";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

let cachedPrice: number = 0;
let lastFetchedAt = 0;
const CACHE_TTL = 30_000; // 30 seconds

export async function GET() {
  const now = Date.now();
  if (cachedPrice > 0 && now - lastFetchedAt < CACHE_TTL) {
    return NextResponse.json({ ethereum: { usd: cachedPrice } });
  }

  try {
    const res = await fetch(COINGECKO_URL, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    cachedPrice = data.ethereum?.usd ?? 0;
    lastFetchedAt = now;
    return NextResponse.json(data);
  } catch {
    // Return stale cache if available
    if (cachedPrice > 0) {
      return NextResponse.json({ ethereum: { usd: cachedPrice } });
    }
    return NextResponse.json(
      { error: "Failed to fetch ETH price" },
      { status: 502 }
    );
  }
}
