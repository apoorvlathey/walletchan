import { ponder } from "ponder:registry";
import { coinLaunch } from "../ponder.schema";
import { CoinAbi } from "../abis/CoinAbi";

const BENEFICIARY_0 = "0x21E2ce70511e4FE542a97708e89520471DAa7A66".toLowerCase();
const BENEFICIARY_1 = "0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1".toLowerCase();
const BENEFICIARY_3 = "0xF60633D02690e2A15A54AB919925F3d038Df163e".toLowerCase();

// Uniswap V4 PoolManager on Base
const POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b";
// Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, ...)
const INITIALIZE_TOPIC0 =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";

const PINATA_GATEWAY_URL = process.env.PINTATA_GATEWAY_URL;
const PINATA_GATEWAY_TOKEN = process.env.PINATA_GATEWAY_TOKEN;

/**
 * Resolve an ipfs:// URI to a Pinata gateway URL and fetch the tweet_url from metadata.
 */
async function fetchTweetUrl(tokenURI: string): Promise<string | null> {
  if (!PINATA_GATEWAY_URL || !PINATA_GATEWAY_TOKEN) return null;
  if (!tokenURI.startsWith("ipfs://")) return null;

  const ipfsHash = tokenURI.slice("ipfs://".length);
  const url = `${PINATA_GATEWAY_URL}/ipfs/${ipfsHash}?pinataGatewayToken=${PINATA_GATEWAY_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const metadata = (await res.json()) as { tweet_url?: string };
    return typeof metadata.tweet_url === "string" ? metadata.tweet_url : null;
  } catch (e) {
    console.error(`Failed to fetch tokenURI metadata for ${tokenURI}:`, e);
    return null;
  }
}

ponder.on(
  "UniswapV4ScheduledMulticurveInitializer:Lock",
  async ({ event, context }) => {
    const { beneficiaries } = event.args;
    const pool = event.args.pool;

    // Must have exactly 4 beneficiaries
    if (beneficiaries.length !== 4) return;

    // Verify the fixed addresses match (case-insensitive)
    if (
      beneficiaries[0].account.toLowerCase() !== BENEFICIARY_0 ||
      beneficiaries[1].account.toLowerCase() !== BENEFICIARY_1 ||
      beneficiaries[3].account.toLowerCase() !== BENEFICIARY_3
    ) {
      return;
    }

    const creatorAddress = beneficiaries[2].account;
    const coinAddress = pool;

    // Extract poolId from the Initialize event in the same transaction.
    // Note: Ponder v0.8+ removed transactionReceipt.logs, so we fetch the
    // receipt via RPC to scan for the PoolManager Initialize log.
    let poolId: `0x${string}` | null = null;
    try {
      const receipt = await context.client.getTransactionReceipt({
        hash: event.transaction.hash,
      });
      const initLog = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === POOL_MANAGER &&
          log.topics[0] === INITIALIZE_TOPIC0
      );
      if (initLog?.topics[1]) {
        poolId = initLog.topics[1] as `0x${string}`;
      }
    } catch (e) {
      console.error(
        `Failed to fetch receipt for poolId extraction (tx: ${event.transaction.hash}):`,
        e
      );
    }

    // Read on-chain metadata (single multicall RPC request)
    let name: string | null = null;
    let symbol: string | null = null;
    let tokenURI: string | null = null;

    try {
      const results = await context.client.multicall({
        contracts: [
          { abi: CoinAbi, address: coinAddress, functionName: "name" },
          { abi: CoinAbi, address: coinAddress, functionName: "symbol" },
          { abi: CoinAbi, address: coinAddress, functionName: "tokenURI" },
        ],
      });
      if (results[0].status === "success") name = results[0].result;
      if (results[1].status === "success") symbol = results[1].result;
      if (results[2].status === "success") tokenURI = results[2].result;
    } catch (e) {
      console.error(`Failed to read metadata for ${coinAddress}:`, e);
    }

    // Resolve IPFS tokenURI via Pinata to get tweet_url
    let tweetUrl: string | null = null;
    if (tokenURI) {
      tweetUrl = await fetchTweetUrl(tokenURI);
    }

    await context.db
      .insert(coinLaunch)
      .values({
        id: coinAddress.toLowerCase(),
        coinAddress,
        poolId,
        name,
        symbol,
        tokenURI,
        tweetUrl,
        creatorAddress,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
      })
      .onConflictDoNothing();
  }
);
