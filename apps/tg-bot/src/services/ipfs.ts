import { config } from "../config.js";

const FETCH_TIMEOUT = 5000;

function getIpfsGatewayUrls(ipfsHash: string): string[] {
  const urls: string[] = [];
  if (config.PINATA_GATEWAY_URL && config.PINATA_GATEWAY_TOKEN) {
    urls.push(
      `${config.PINATA_GATEWAY_URL}/ipfs/${ipfsHash}?pinataGatewayToken=${config.PINATA_GATEWAY_TOKEN}`
    );
  }
  urls.push(`https://ipfs.io/ipfs/${ipfsHash}`);
  urls.push(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
  return urls;
}

function extractIpfsHash(tokenURI: string): string | null {
  // Handle ipfs:// protocol
  if (tokenURI.startsWith("ipfs://")) {
    return tokenURI.slice(7);
  }
  // Handle gateway URLs containing /ipfs/
  const match = tokenURI.match(/\/ipfs\/(.+)/);
  if (match) return match[1];
  return null;
}

export async function resolveTokenURI(
  tokenURI: string | null
): Promise<{ tweetUrl: string | null }> {
  if (!tokenURI) return { tweetUrl: null };

  const hash = extractIpfsHash(tokenURI);

  // If it's not an IPFS URI, try fetching directly
  const urls = hash ? getIpfsGatewayUrls(hash) : [tokenURI];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (!res.ok) continue;
      const metadata = (await res.json()) as { tweet_url?: string };
      const tweetUrl =
        typeof metadata.tweet_url === "string" ? metadata.tweet_url : null;
      return { tweetUrl };
    } catch {
      continue;
    }
  }

  return { tweetUrl: null };
}
