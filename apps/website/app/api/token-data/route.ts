import { NextResponse } from "next/server";
import { GECKOTERMINAL_API_URL } from "../../constants";

export async function GET() {
  try {
    const response = await fetch(GECKOTERMINAL_API_URL, {
      next: { revalidate: 5 },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GeckoTerminal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch token data" },
      { status: 500 }
    );
  }
}
