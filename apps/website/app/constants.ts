import {
  WCHAN_TOKEN_ADDRESS,
  WCHAN_POOL_ID,
} from "@bankr-wallet/shared/contracts";

export const TOKEN_ADDRESS = WCHAN_TOKEN_ADDRESS;
export const POOL_ADDRESS = WCHAN_POOL_ID;

// App URLs
export const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/bankrwallet/kofbkhbkfhiollbhjkbebajngppmpbgc";
export const GITHUB_URL = "https://github.com/apoorvlathey/walletchan";
export const GITHUB_RELEASES_URL =
  "https://github.com/apoorvlathey/walletchan/releases/latest";
export const TWITTER_URL = "https://x.com/walletchan_";
export const TELEGRAM_URL = "https://t.me/bnkrwpublic";
export const BANKR_API_URL = "https://bankr.bot/api";

// External URLs
export const BUY_LINK =
  "https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=0xBa5ED0000e1CA9136a695f0a848012A16008B032";
export const DEXSCREENER_URL = `https://dexscreener.com/base/${POOL_ADDRESS}`;
export const GECKOTERMINAL_URL = `https://www.geckoterminal.com/base/pools/${POOL_ADDRESS}`;
export const GECKOTERMINAL_EMBED_URL = `https://www.geckoterminal.com/base/pools/${POOL_ADDRESS}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=market_cap&resolution=1D`;
export const GECKOTERMINAL_API_URL = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ADDRESS}`;
// FIXME: update to WCHAN coingecko URL once the new coin is live there
export const COINGECKO_URL = `https://www.coingecko.com/en/coins/bankrwallet`;

// Indexer API
export const INDEXER_API_URL =
  process.env.NEXT_PUBLIC_INDEXER_API_URL || "http://localhost:42069";

// TG Bot API
export const TG_BOT_API_URL =
  process.env.NEXT_PUBLIC_TG_BOT_API_URL || "http://localhost:3001";

// Staking Indexer API (separate from coin indexer)
export const STAKING_INDEXER_API_URL =
  process.env.NEXT_PUBLIC_STAKING_INDEXER_API_URL || "http://localhost:42070";
