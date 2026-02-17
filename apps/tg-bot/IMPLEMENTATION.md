# TG Bot — Implementation

## Overview

Grammy bot + Hono API server in a single Node.js process. Gates access to a private Telegram group based on sBNKRW staked balance. Deployed on Railway.

## Process Architecture

```
src/index.ts (entry point)
├── Grammy bot (long polling)
├── Hono API server (HTTP on PORT)
└── Balance checker (setInterval, every 5min)
```

All three run concurrently in one process. No webhooks — Grammy uses long polling so no public URL is needed for the bot itself. The Hono API does need to be publicly accessible for the website to POST verification results.

## Database

PostgreSQL via Drizzle ORM. Two tables:

- **`users`** — Linked TG accounts. `tg_id` (PK), `wallet_address` (UNIQUE), `is_member` (tracks group membership).
- **`verification_tokens`** — Ephemeral tokens. UUID PK, 10min expiry, single-use. Links a TG user ID to a browser session.

Migrations managed by `drizzle-kit`. Run `db:generate` after schema changes, `db:migrate` to apply.

## Bot Commands

All commands are DM-only except `/chatid` (admin-only, works in groups).

| Command | Handler | Description |
|---------|---------|-------------|
| `/start` | Welcome message | Shows threshold + points to `/help` |
| `/help` | Command list | Lists available commands |
| `/verify` | Creates token, sends link | Generates UUID, stores in DB, sends inline button URL |
| `/status` | Shows wallet + balance | Fetches balance from indexer, shows eligibility |
| `/chatid` | Admin utility | Returns `ctx.chat.id` — used to find `PRIVATE_GROUP_ID` |

### Group Filtering Middleware

```
bot.command("chatid", ...) ← registered BEFORE middleware, works everywhere
bot.use(middleware)         ← drops all non-DM, non-chat_member updates
bot.command("start", ...)  ← DM only
bot.command("help", ...)   ← DM only
...
bot.on("chat_member", ...) ← passes through (not a chat message)
```

The middleware at `bot.use()` checks `ctx.chat.type !== "private"` and silently returns (no response) for group messages. `chat_member` events pass through because they don't have `ctx.chat` in the same way — the guard checks `!ctx.chatMember` to let those through.

## Verification Flow

```
1. User DMs bot → /verify
2. Bot creates UUID token (10min expiry) → stores in verification_tokens
3. Bot sends inline button: bankrwallet.app/verify?token=xxx

4. User opens link in browser
5. Website calls GET /api/verify-info?token=xxx → validates token exists + not expired + not used
6. User connects wallet (RainbowKit)
7. Website fetches balance from staking indexer: GET {INDEXER}/balances/{address}
8. If balance >= threshold, user signs message:
     "Verify Telegram account for BankrWallet\nToken: {token}\nTimestamp: {unix}"
9. Website POSTs to /api/verify: { token, signature, address, timestamp }

10. API validates:
    - Signature timestamp <= 5 minutes old (replay protection)
    - Token exists, not expired, not used
    - viem verifyMessage confirms signer matches address
    - Balance >= MIN_STAKE_THRESHOLD (re-checked server-side)
    - Wallet not linked to a different TG account (UNIQUE constraint)
11. On success:
    - Upserts user row (re-verify = update wallet)
    - Marks token as used
    - Creates one-time invite link (member_limit: 1)
    - DMs user the invite link
    - Returns { success: true, inviteLink } (fallback if DM blocked)
```

## API Endpoints

All under Hono with CORS enabled for the website origin.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/verify-info?token=` | Validate token, return threshold info |
| POST | `/api/verify` | Complete verification (body: `{token, signature, address, timestamp}`) |
| GET | `/api/users?limit=&offset=` | List verified users with live balances (enriched from indexer) |

## Balance Checker Job

`src/jobs/balanceChecker.ts` — runs on a `setInterval` (default 5min).

1. Queries all users where `is_member = true`
2. For each, fetches balance from staking indexer
3. If below threshold:
   - Kicks from group (`banChatMember` → `unbanChatMember` so they can rejoin later)
   - DMs user with explanation + stake link + `/verify` instructions
   - Sets `is_member = false`
4. Errors are caught per-user — one failure doesn't stop the rest

## Services

### `services/verification.ts`
Token lifecycle (create, validate) + signature verification via viem `verifyMessage` + wallet linking (upsert with conflict handling).

### `services/balance.ts`
Fetches `GET {INDEXER_API_URL}/balances/{address}` from the staking indexer. Returns `BigInt` shares. `meetsThreshold()` compares against `MIN_STAKE_THRESHOLD`.

### `services/group.ts`
Telegram group operations: `createInviteLink` (one-time, `member_limit: 1`), `kickUser` (ban + unban), `sendKickDM`. All require `PRIVATE_GROUP_ID` to be set — throws if missing.

## Config

`src/config.ts` — Zod schema validates all env vars at startup. Bot won't start with invalid config (except `PRIVATE_GROUP_ID` which is optional for initial `/chatid` setup).

## File Structure

```
src/
├── index.ts              # Entry: starts bot + API + balance checker
├── config.ts             # Zod env validation
├── bot.ts                # Grammy commands + middleware
├── api.ts                # Hono routes
├── db/
│   ├── schema.ts         # Drizzle table definitions
│   ├── index.ts          # DB connection
│   └── migrate.ts        # Migration runner
├── services/
│   ├── verification.ts   # Token + signature logic
│   ├── balance.ts        # Indexer balance fetching
│   └── group.ts          # TG group management
└── jobs/
    └── balanceChecker.ts # Periodic balance enforcement
```
