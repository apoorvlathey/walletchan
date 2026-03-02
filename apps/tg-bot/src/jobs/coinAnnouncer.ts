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

interface QueuedAnnouncement {
  coin: Coin;
  text: string;
  tweetUrl: string | null;
  keyboard: InlineKeyboard;
  retries: number;
}

const MAX_ANNOUNCED_IDS = 500;
const MIN_SEND_INTERVAL_MS = 1500; // 1.5s between sends
const MAX_RETRIES = 3;
const RETRY_BUFFER_MS = 500;
const MAX_QUEUE_SIZE = 50;

async function fetchLatestCoins(): Promise<Coin[]> {
  const res = await fetch(
    `${config.COINS_INDEXER_API_URL}/coins?limit=50&offset=0`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function startCoinAnnouncer(
  bot: Bot,
  intervalSeconds: number = 2,
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
  const sendQueue: QueuedAnnouncement[] = [];
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Send queue drain loop ---

  function scheduleDrain(delayMs: number = MIN_SEND_INTERVAL_MS): void {
    if (drainTimer) return; // already scheduled
    drainTimer = setTimeout(() => {
      drainTimer = null;
      drainQueue();
    }, delayMs);
  }

  async function drainQueue(): Promise<void> {
    if (sendQueue.length === 0) return;

    const item = sendQueue[0]; // peek

    try {
      await bot.api.sendMessage(chatId, item.text, {
        parse_mode: "HTML",
        link_preview_options: item.tweetUrl
          ? { url: item.tweetUrl, prefer_large_media: true }
          : { is_disabled: true },
        reply_markup: item.keyboard,
        ...(threadId ? { message_thread_id: threadId } : {}),
      });

      sendQueue.shift();
      console.log(
        `[CoinAnnouncer] Announced $${item.coin.symbol} (${item.coin.id}), queue: ${sendQueue.length}`,
      );

      if (sendQueue.length > 0) {
        scheduleDrain(MIN_SEND_INTERVAL_MS);
      }
    } catch (err: any) {
      const retryAfter = err?.parameters?.retry_after;

      if (retryAfter) {
        const waitMs = retryAfter * 1000 + RETRY_BUFFER_MS;
        console.warn(
          `[CoinAnnouncer] Rate limited (429), waiting ${retryAfter}s. Queue: ${sendQueue.length}`,
        );
        scheduleDrain(waitMs);
      } else if (item.retries < MAX_RETRIES) {
        item.retries++;
        const backoffMs = Math.min(2000 * Math.pow(2, item.retries - 1), 30_000);
        console.warn(
          `[CoinAnnouncer] Send failed for ${item.coin.id}, retry ${item.retries}/${MAX_RETRIES} in ${backoffMs}ms:`,
          err?.message || err,
        );
        scheduleDrain(backoffMs);
      } else {
        sendQueue.shift();
        console.error(
          `[CoinAnnouncer] Dropping coin ${item.coin.id} after ${MAX_RETRIES} retries:`,
          err?.message || err,
        );
        if (sendQueue.length > 0) {
          scheduleDrain(MIN_SEND_INTERVAL_MS);
        }
      }
    }
  }

  // --- Poll: collect new coins into queue ---

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
          `[CoinAnnouncer] Initialized with latest timestamp: ${latestTimestamp}, ${announcedIds.size} existing coins`,
        );
        return;
      }

      // Find new coins (timestamp >= latestTimestamp and not already announced)
      const newCoins = coins
        .filter(
          (c) => c.timestamp >= latestTimestamp && !announcedIds.has(c.id),
        )
        .reverse(); // oldest first

      for (const coin of newCoins) {
        if (sendQueue.length >= MAX_QUEUE_SIZE) {
          console.warn(`[CoinAnnouncer] Queue full (${MAX_QUEUE_SIZE}), dropping coin ${coin.id}`);
          announcedIds.add(coin.id);
          continue;
        }

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
            text += `\n\nhttps://www.geckoterminal.com/base/pools/${coin.poolId}`;
          }

          const keyboard = new InlineKeyboard().url(
            "\u26A1 Buy",
            `https://coins.walletchan.com?buy=${coin.coinAddress}`,
          );

          sendQueue.push({ coin, text, tweetUrl, keyboard, retries: 0 });
          announcedIds.add(coin.id);
        } catch (err) {
          console.error(
            `[CoinAnnouncer] Failed to prepare coin ${coin.id}:`,
            err,
          );
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

      // Kick the drain loop if items were queued
      if (sendQueue.length > 0) {
        scheduleDrain(0);
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
