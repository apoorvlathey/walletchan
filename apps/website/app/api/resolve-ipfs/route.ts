import { NextRequest, NextResponse } from "next/server";

const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL;
const PINATA_GATEWAY_TOKEN = process.env.PINATA_GATEWAY_TOKEN;

function getIpfsGatewayUrls(ipfsHash: string): string[] {
  const urls: string[] = [];
  if (PINATA_GATEWAY_URL && PINATA_GATEWAY_TOKEN) {
    urls.push(
      `${PINATA_GATEWAY_URL}/ipfs/${ipfsHash}?pinataGatewayToken=${PINATA_GATEWAY_TOKEN}`
    );
  }
  urls.push(`https://ipfs.io/ipfs/${ipfsHash}`);
  urls.push(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
  return urls;
}

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("hash");

  if (!hash) {
    return NextResponse.json(
      { error: "Missing 'hash' query parameter" },
      { status: 400 }
    );
  }

  const urls = getIpfsGatewayUrls(hash);

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const metadata = (await res.json()) as { tweet_url?: string };
      const tweetUrl =
        typeof metadata.tweet_url === "string" ? metadata.tweet_url : null;

      return NextResponse.json(
        { tweetUrl },
        {
          headers: {
            // IPFS content is immutable — cache aggressively
            "Cache-Control":
              "public, max-age=86400, s-maxage=86400, immutable",
          },
        }
      );
    } catch {
      continue;
    }
  }

  // All gateways failed
  return NextResponse.json(
    { tweetUrl: null },
    {
      headers: {
        // Short cache on failure so we retry sooner
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    }
  );
}
