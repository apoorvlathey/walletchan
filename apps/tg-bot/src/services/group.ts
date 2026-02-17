import type { Bot } from "grammy";
import { config } from "../config.js";

function requireGroupId(): number {
  if (!config.PRIVATE_GROUP_ID) {
    throw new Error("PRIVATE_GROUP_ID is not configured. Use /chatid in your group to find it.");
  }
  return config.PRIVATE_GROUP_ID;
}

export async function createInviteLink(bot: Bot): Promise<string> {
  const invite = await bot.api.createChatInviteLink(requireGroupId(), {
    member_limit: 1,
    name: `verify-${Date.now()}`,
  });
  return invite.invite_link;
}

export async function kickUser(bot: Bot, userId: number): Promise<void> {
  try {
    const groupId = requireGroupId();
    // Ban then immediately unban so they can rejoin later after re-staking
    await bot.api.banChatMember(groupId, userId);
    await bot.api.unbanChatMember(groupId, userId);
  } catch (err) {
    console.error(`Failed to kick user ${userId}:`, err);
  }
}

export async function sendKickDM(bot: Bot, userId: number): Promise<void> {
  try {
    await bot.api.sendMessage(
      userId,
      `Your sBNKRW staked balance has fallen below the required threshold.\n\n` +
        `You have been removed from the private group.\n\n` +
        `To rejoin:\n` +
        `1. Stake more BNKRW at ${config.STAKE_URL}\n` +
        `2. Run /verify to get a new verification link`
    );
  } catch (err) {
    // User may have blocked the bot — nothing we can do
    console.error(`Failed to send kick DM to ${userId}:`, err);
  }
}
