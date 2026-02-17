import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { getUserBalance, meetsThreshold } from "../services/balance.js";
import { kickUser, sendKickDM } from "../services/group.js";

async function checkBalances(bot: Bot): Promise<void> {
  console.log("[BalanceChecker] Running balance check...");

  const members = await db.query.users.findMany({
    where: eq(users.isMember, true),
  });

  console.log(`[BalanceChecker] Checking ${members.length} members`);

  for (const member of members) {
    if (!member.walletAddress) continue;

    try {
      const balance = await getUserBalance(member.walletAddress);

      if (!meetsThreshold(balance)) {
        console.log(
          `[BalanceChecker] User ${member.tgId} below threshold, kicking...`
        );

        const userId = Number(member.tgId);
        await kickUser(bot, userId);
        await sendKickDM(bot, userId);

        await db
          .update(users)
          .set({ isMember: false })
          .where(eq(users.tgId, member.tgId));
      }
    } catch (err) {
      console.error(
        `[BalanceChecker] Error checking user ${member.tgId}:`,
        err
      );
    }
  }

  console.log("[BalanceChecker] Balance check complete.");
}

export function startBalanceChecker(
  bot: Bot,
  intervalMinutes: number = 5
): NodeJS.Timeout {
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run immediately on start
  checkBalances(bot).catch((err) =>
    console.error("[BalanceChecker] Initial check failed:", err)
  );

  // Then run on interval
  return setInterval(() => {
    checkBalances(bot).catch((err) =>
      console.error("[BalanceChecker] Scheduled check failed:", err)
    );
  }, intervalMs);
}
