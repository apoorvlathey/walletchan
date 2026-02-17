import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  INDEXER_API_URL: z
    .string()
    .url()
    .default("http://localhost:42070"),
  PRIVATE_GROUP_ID: z.coerce.number().int().optional(),
  MIN_STAKE_THRESHOLD: z.string().default("1000000000000000000000"), // 1000 sBNKRW
  VERIFY_URL: z
    .string()
    .url()
    .default("https://bankrwallet.app/verify"),
  STAKE_URL: z
    .string()
    .url()
    .default("https://stake.bankrwallet.app"),
  ADMIN_TG_ID: z.coerce.bigint(),
  PORT: z.coerce.number().int().default(3001),
});

export const config = envSchema.parse(process.env);

export type Config = z.infer<typeof envSchema>;
