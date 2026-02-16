import { NextResponse } from "next/server";
import {
  BASE_CHAIN_ID,
  BNKRW_TOKEN_ADDRESS,
} from "@bankr-wallet/shared/contracts";

const WASABI_API_URL = "https://api.wasabi.xyz";

export async function GET() {
  try {
    const url = `${WASABI_API_URL}/v1/perps/vaults?chainId=${BASE_CHAIN_ID}&token=${BNKRW_TOKEN_ADDRESS}`;

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
