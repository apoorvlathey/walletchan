import {
  pgTable,
  bigint,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  tgId: bigint("tg_id", { mode: "bigint" }).primaryKey(),
  tgUsername: text("tg_username"),
  walletAddress: text("wallet_address").unique(),
  verifiedAt: timestamp("verified_at"),
  isMember: boolean("is_member").default(false).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  token: text("token").primaryKey(),
  tgId: bigint("tg_id", { mode: "bigint" }).notNull(),
  tgUsername: text("tg_username"),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
});
