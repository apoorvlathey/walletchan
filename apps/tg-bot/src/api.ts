import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { Bot } from "grammy";
import { formatUnits } from "viem";
import { db } from "./db/index.js";
import { users } from "./db/schema.js";
import { config } from "./config.js";
import {
  validateToken,
  verifySignature,
  linkWalletToTelegram,
} from "./services/verification.js";
import {
  getWchanBalance,
  getCombinedBalance,
  meetsThreshold,
  formatThreshold,
} from "./services/balance.js";
import { createInviteLink } from "./services/group.js";

const verifyBodySchema = z.object({
  token: z.string().uuid(),
  signature: z.string().startsWith("0x"),
  address: z.string().startsWith("0x").length(42),
  timestamp: z.number().int().positive(),
});

export function createApi(bot: Bot): Hono {
  const app = new Hono();

  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/verify-info", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.json({ valid: false, error: "Missing token" }, 400);
    }

    const result = await validateToken(token);

    return c.json({
      valid: result.valid,
      threshold: config.MIN_STAKE_THRESHOLD,
      thresholdFormatted: formatThreshold(),
      ...(result.valid ? {} : { error: "Invalid or expired token" }),
    });
  });

  app.post("/api/verify", async (c) => {
    let body: z.infer<typeof verifyBodySchema>;
    try {
      body = verifyBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ success: false, error: "Invalid request body" }, 400);
    }

    // Verify signature and token
    const sigResult = await verifySignature(
      body.token,
      body.signature as `0x${string}`,
      body.address as `0x${string}`,
      body.timestamp
    );

    if (!sigResult.valid) {
      return c.json({ success: false, error: sigResult.error }, 400);
    }

    // Check balance (new verifications require sWCHAN only)
    const balance = await getWchanBalance(body.address);
    if (!meetsThreshold(balance)) {
      const formatted = formatUnits(balance, 18);
      return c.json(
        {
          success: false,
          error: `Insufficient stake. You have ${parseFloat(formatted).toLocaleString()} sWCHAN, need ${formatThreshold()}.`,
        },
        400
      );
    }

    // Link wallet
    const linkResult = await linkWalletToTelegram(
      body.token,
      body.address,
      sigResult.tgId!,
      null
    );

    if (!linkResult.success) {
      return c.json({ success: false, error: linkResult.error }, 400);
    }

    // Generate invite link
    let inviteLink: string;
    try {
      inviteLink = await createInviteLink(bot);
    } catch (err) {
      console.error("Failed to create invite link:", err);
      return c.json(
        { success: false, error: "Failed to create invite link" },
        500
      );
    }

    // DM the user with the invite link
    try {
      await bot.api.sendMessage(
        Number(sigResult.tgId!),
        `Verification successful! Your wallet has been linked.\n\n` +
          `Join the private group using this one-time link:\n${inviteLink}`
      );
    } catch (err) {
      // User may have blocked the bot — still return invite link in response
      console.error("Failed to DM invite link:", err);
    }

    return c.json({ success: true, inviteLink });
  });

  app.get("/api/users", async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
    const offset = parseInt(c.req.query("offset") || "0");

    const allUsers = await db.query.users.findMany({
      limit,
      offset,
    });

    // Enrich with current balances
    const enriched = await Promise.all(
      allUsers.map(async (user) => {
        const raw = user.walletAddress
          ? await getCombinedBalance(user.walletAddress)
          : 0n;
        return {
          tgId: user.tgId.toString(),
          tgUsername: user.tgUsername,
          walletAddress: user.walletAddress,
          verifiedAt: user.verifiedAt?.toISOString(),
          isMember: user.isMember,
          stakedBalance: formatUnits(raw, 18),
          meetsThreshold: meetsThreshold(raw),
        };
      })
    );

    return c.json({ users: enriched, total: enriched.length });
  });

  return app;
}
