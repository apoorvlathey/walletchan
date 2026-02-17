import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { createBot } from "./bot.js";
import { createApi } from "./api.js";
import { startBalanceChecker } from "./jobs/balanceChecker.js";
import { startCoinAnnouncer } from "./jobs/coinAnnouncer.js";

async function main() {
  console.log("Starting BankrWallet TG Bot...");

  // Create bot
  const bot = createBot();

  // Start bot (long polling)
  bot.start({
    onStart: () => console.log(`Bot started (long polling)`),
  });

  // Start balance checker (every 5 minutes)
  startBalanceChecker(bot, 5);

  // Start coin launch announcer (every 2 seconds)
  startCoinAnnouncer(bot, 2);

  // Start API server
  const api = createApi(bot);
  serve(
    {
      fetch: api.fetch,
      port: config.PORT,
    },
    (info) => {
      console.log(`API server running on http://localhost:${info.port}`);
    }
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
