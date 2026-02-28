import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { getCombinedBalance, meetsThreshold } from "../services/balance.js";
import { kickUser, sendKickDM } from "../services/group.js";

async function checkBalances(bot: Bot): Promise<void> {
  console.log("[BalanceChecker] Running balance check...");

  const members = await db.query.users.findMany({
    where: eq(users.isMember, true),
  });

  console.log(`[BalanceChecker] Checking ${members.length} members`);

  const gracePeriodMs = config.KICK_GRACE_PERIOD_MINUTES * 60 * 1000;

  for (const member of members) {
    if (!member.walletAddress) continue;

    // Never kick admin
    if (member.tgId === config.ADMIN_TG_ID) continue;

    try {
      const balance = await getCombinedBalance(member.walletAddress);

      if (!meetsThreshold(balance)) {
        if (!member.belowThresholdSince) {
          // First detection — set timestamp, don't kick yet
          console.log(
            `[BalanceChecker] User ${member.tgId} below threshold, starting grace period`
          );
          await db
            .update(users)
            .set({ belowThresholdSince: new Date() })
            .where(eq(users.tgId, member.tgId));
        } else {
          // Check if grace period has elapsed
          const elapsed = Date.now() - member.belowThresholdSince.getTime();
          if (elapsed >= gracePeriodMs) {
            console.log(
              `[BalanceChecker] User ${member.tgId} grace period expired, kicking...`
            );

            const userId = Number(member.tgId);
            await kickUser(bot, userId);
            await sendKickDM(bot, userId);

            await db
              .update(users)
              .set({ isMember: false, belowThresholdSince: null })
              .where(eq(users.tgId, member.tgId));
          }
          // Otherwise still within grace period — skip
        }
      } else {
        // Above threshold — clear grace period if set
        if (member.belowThresholdSince) {
          await db
            .update(users)
            .set({ belowThresholdSince: null })
            .where(eq(users.tgId, member.tgId));
        }
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
