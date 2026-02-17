import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { verifyMessage } from "viem";
import { db } from "../db/index.js";
import { users, verificationTokens } from "../db/schema.js";
import { config } from "../config.js";

const TOKEN_EXPIRY_MINUTES = 10;
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

export function buildVerificationMessage(
  token: string,
  timestamp: number
): string {
  return `Verify Telegram account for BankrWallet\nToken: ${token}\nTimestamp: ${timestamp}`;
}

export async function createVerificationToken(
  tgId: bigint,
  tgUsername: string | undefined
): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(verificationTokens).values({
    token,
    tgId,
    tgUsername: tgUsername ?? null,
    expiresAt,
    used: false,
  });

  return token;
}

export async function validateToken(
  token: string
): Promise<{ valid: boolean; tgId?: bigint; tgUsername?: string | null }> {
  const row = await db.query.verificationTokens.findFirst({
    where: eq(verificationTokens.token, token),
  });

  if (!row) return { valid: false };
  if (row.used) return { valid: false };
  if (row.expiresAt < new Date()) return { valid: false };

  return { valid: true, tgId: row.tgId, tgUsername: row.tgUsername };
}

export async function verifySignature(
  token: string,
  signature: `0x${string}`,
  address: `0x${string}`,
  timestamp: number
): Promise<{ valid: boolean; error?: string; tgId?: bigint }> {
  // Check timestamp freshness
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_SECONDS) {
    return { valid: false, error: "Signature timestamp expired" };
  }

  // Validate the token
  const tokenResult = await validateToken(token);
  if (!tokenResult.valid) {
    return { valid: false, error: "Invalid or expired verification token" };
  }

  // Verify the signature
  const message = buildVerificationMessage(token, timestamp);
  const isValid = await verifyMessage({
    address,
    message,
    signature,
  });

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true, tgId: tokenResult.tgId };
}

export async function linkWalletToTelegram(
  token: string,
  walletAddress: string,
  tgId: bigint,
  tgUsername: string | null
): Promise<{ success: boolean; error?: string }> {
  // Check if wallet is already linked to a different TG account
  const existingUser = await db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress.toLowerCase()),
  });

  if (existingUser && existingUser.tgId !== tgId) {
    return {
      success: false,
      error: "This wallet is already linked to another Telegram account",
    };
  }

  // Upsert user — re-verify updates the wallet address
  await db
    .insert(users)
    .values({
      tgId,
      tgUsername,
      walletAddress: walletAddress.toLowerCase(),
      verifiedAt: new Date(),
      isMember: false,
    })
    .onConflictDoUpdate({
      target: users.tgId,
      set: {
        tgUsername,
        walletAddress: walletAddress.toLowerCase(),
        verifiedAt: new Date(),
      },
    });

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ used: true })
    .where(eq(verificationTokens.token, token));

  return { success: true };
}
