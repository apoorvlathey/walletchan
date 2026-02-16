import { NextResponse } from "next/server";

const WASABI_API_URL = "https://api.wasabi.xyz";
const BNKRW_TOKEN_ADDRESS = "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07";
const CHAIN_ID = 8453;

export async function GET() {
  try {
    const url = `${WASABI_API_URL}/v1/perps/vaults?chainId=${CHAIN_ID}&token=${BNKRW_TOKEN_ADDRESS}`;

    const headers: Record<string, string> = {
      accept: "application/json",
    };

    const apiKey = process.env.WASABI_API_KEY;
    if (apiKey) {
      headers["X-API-KEY"] = apiKey;
    }

    const response = await fetch(url, {
      headers,
      next: { revalidate: 30 },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Wasabi API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vault data" },
      { status: 500 }
    );
  }
}
