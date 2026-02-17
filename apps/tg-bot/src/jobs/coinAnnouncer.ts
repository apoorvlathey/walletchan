import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { resolveTokenURI } from "../services/ipfs.js";

interface Coin {
  id: string;
  coinAddress: string;
  poolId: string | null;
  name: string;
  symbol: string;
  tokenURI: string;
  tweetUrl: string | null;
  timestamp: string;
}

const MAX_ANNOUNCED_IDS = 500;

async function fetchLatestCoins(): Promise<Coin[]> {
  const res = await fetch(
    `${config.COINS_INDEXER_API_URL}/coins?limit=50&offset=0`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function startCoinAnnouncer(
  bot: Bot,
  intervalSeconds: number = 2
): NodeJS.Timeout {
  const maybeChatId = config.COIN_ANNOUNCE_CHAT_ID;
  if (!maybeChatId) {
    console.log("[CoinAnnouncer] No COIN_ANNOUNCE_CHAT_ID set, skipping.");
    return setInterval(() => {}, 60_000); // noop interval
  }
  const chatId: number = maybeChatId;
  const threadId = config.COIN_ANNOUNCE_THREAD_ID;

  let latestTimestamp = "0";
  const announcedIds = new Set<string>();
  let initialized = false;

  async function poll(): Promise<void> {
    try {
      const coins = await fetchLatestCoins();

      if (!initialized) {
        // Seed state from first poll — don't announce existing coins
        if (coins.length > 0) {
          latestTimestamp = coins[0].timestamp;
          for (const c of coins) {
            announcedIds.add(c.id);
          }
        }
        initialized = true;
        console.log(
          `[CoinAnnouncer] Initialized with latest timestamp: ${latestTimestamp}, ${announcedIds.size} existing coins`
        );
        return;
      }

      // Find new coins (timestamp >= latestTimestamp and not already announced)
      const newCoins = coins
        .filter((c) => c.timestamp >= latestTimestamp && !announcedIds.has(c.id))
        .reverse(); // oldest first

      for (const coin of newCoins) {
        try {
          // Resolve tweet URL from IPFS if not already provided by indexer
          let tweetUrl = coin.tweetUrl;
          if (!tweetUrl) {
            const resolved = await resolveTokenURI(coin.tokenURI);
            tweetUrl = resolved.tweetUrl;
          }

          // Build message
          let text = `<b>$${escapeHtml(coin.symbol)}</b> (${escapeHtml(coin.name)}) launched`;
          if (tweetUrl) {
            tweetUrl = tweetUrl.replace("twitter.com", "x.com");
            text += `\n\nTweet: ${tweetUrl}`;
          }
          if (coin.poolId) {
            text += `\nhttps://www.geckoterminal.com/base/pools/${coin.poolId}`;
          }

          const keyboard = new InlineKeyboard().url(
            "\u26A1 Buy",
            `https://coins.bankrwallet.app?buy=${coin.coinAddress}`
          );

          await bot.api.sendMessage(chatId, text, {
            parse_mode: "HTML",
            link_preview_options: tweetUrl
              ? { url: tweetUrl, prefer_large_media: true }
              : { is_disabled: true },
            reply_markup: keyboard,
            ...(threadId ? { message_thread_id: threadId } : {}),
          });

          announcedIds.add(coin.id);
        } catch (err) {
          console.error(
            `[CoinAnnouncer] Failed to announce coin ${coin.id}:`,
            err
          );
          // Continue with next coin
        }
      }

      // Update latest timestamp
      if (coins.length > 0 && coins[0].timestamp > latestTimestamp) {
        latestTimestamp = coins[0].timestamp;
      }

      // Prune announced IDs to prevent unbounded growth
      if (announcedIds.size > MAX_ANNOUNCED_IDS) {
        const idsArray = Array.from(announcedIds);
        const toRemove = idsArray.slice(0, idsArray.length - MAX_ANNOUNCED_IDS);
        for (const id of toRemove) {
          announcedIds.delete(id);
        }
      }
    } catch (err) {
      console.error("[CoinAnnouncer] Poll error:", err);
    }
  }

  // Run first poll immediately
  poll();

  const intervalMs = intervalSeconds * 1000;
  return setInterval(() => {
    poll();
  }, intervalMs);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
