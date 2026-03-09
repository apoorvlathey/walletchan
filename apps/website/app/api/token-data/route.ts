import { NextResponse } from "next/server";
import { getWchanPoolData } from "../../lib/geckoTerminalCache";

export async function GET() {
  try {
    const data = await getWchanPoolData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GeckoTerminal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch token data" },
      { status: 500 }
    );
  }
}
