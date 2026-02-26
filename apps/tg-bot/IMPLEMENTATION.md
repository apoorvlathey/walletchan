# TG Bot — Implementation

## Overview

Grammy bot + Hono API server in a single Node.js process. Gates access to a private Telegram group based on sBNKRW staked balance. Deployed on Railway.

## Process Architecture

```
src/index.ts (entry point)
├── Grammy bot (long polling)
├── Hono API server (HTTP on PORT)
├── Balance checker (setInterval, every 5min)
└── Coin announcer (setInterval, every 2s)
```

All three run concurrently in one process. No webhooks — Grammy uses long polling so no public URL is needed for the bot itself. The Hono API does need to be publicly accessible for the website to POST verification results.

## Database

PostgreSQL via Drizzle ORM. Two tables:

- **`users`** — Linked TG accounts. `tg_id` (PK), `wallet_address` (UNIQUE), `is_member` (tracks group membership).
- **`verification_tokens`** — Ephemeral tokens. UUID PK, 10min expiry, single-use. Links a TG user ID to a browser session.

Migrations managed by `drizzle-kit`. Run `db:generate` after schema changes, `db:migrate` to apply.

## Bot Commands

All commands are DM-only except `/chatid` (admin-only, works in groups).

| Command   | Handler                   | Description                                                                                                                                           |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/start`  | Welcome message           | Shows threshold + points to `/help`. Supports deep link: `?start=verify` auto-triggers verification                                                   |
| `/help`   | Command list              | Lists available commands                                                                                                                              |
| `/verify` | Creates token, sends link | Generates UUID, stores in DB, sends inline button URL                                                                                                 |
| `/status` | Shows wallet + balance    | Fetches balance from indexer, shows eligibility                                                                                                       |
| `/chatid` | Admin utility             | Returns `ctx.chat.id` + `message_thread_id` (if in a topic) — used to find `PRIVATE_GROUP_ID`, `COIN_ANNOUNCE_CHAT_ID`, and `COIN_ANNOUNCE_THREAD_ID` |

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

## Deep Links

`https://t.me/WalletChanBot?start=verify` — opens bot DM and auto-triggers verification (same as `/verify`).

The `/start` command checks `ctx.match` for the payload. If it equals `"verify"`, it runs the verification flow instead of showing the welcome message. This is used in the public channel's pinned message button.

## Admin Protection

- **Balance checker**: skips `ADMIN_TG_ID` — admin is never kicked for low balance
- **chat_member handler**: skips admin on join — admin is never kicked as "unverified"
- **Unverified users**: anyone who joins the private group without being in the `users` table gets kicked immediately (except admin)

## Verification Flow

```
1. User DMs bot → /verify (or opens deep link ?start=verify)
2. Bot creates UUID token (10min expiry) → stores in verification_tokens
3. Bot sends inline button: walletchan.com/verify?token=xxx

4. User opens link in browser
5. Website calls GET /api/verify-info?token=xxx → validates token exists + not expired + not used
6. User connects wallet (RainbowKit)
7. Website fetches balance from staking indexer: GET {INDEXER}/balances/{address}
8. If balance >= threshold, user signs message:
     "Verify Telegram account for WalletChan\nToken: {token}\nTimestamp: {unix}"
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

| Method | Path                        | Purpose                                                                |
| ------ | --------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/health`               | Health check                                                           |
| GET    | `/api/verify-info?token=`   | Validate token, return threshold info                                  |
| POST   | `/api/verify`               | Complete verification (body: `{token, signature, address, timestamp}`) |
| GET    | `/api/users?limit=&offset=` | List verified users with live balances (enriched from indexer)         |

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

## Coin Launch Announcer Job

`src/jobs/coinAnnouncer.ts` — polls the coins indexer every 2 seconds for new coin launches and posts announcements to a designated Telegram chat.

**Config vars:**

- `COINS_INDEXER_API_URL` — URL of the coins indexer API (default: `http://localhost:42069`)
- `COIN_ANNOUNCE_CHAT_ID` — Telegram chat ID to post announcements to (optional; announcer is skipped if not set)
- `COIN_ANNOUNCE_THREAD_ID` — Topic/thread ID within the chat (optional; posts to General topic if not set). Use `/chatid` inside the target topic to get this value.
- `PINATA_GATEWAY_URL` / `PINATA_GATEWAY_TOKEN` — Optional dedicated Pinata IPFS gateway for faster metadata resolution

**Setup for groups with topics:**

1. Deploy with `COIN_ANNOUNCE_CHAT_ID` and `COIN_ANNOUNCE_THREAD_ID` unset (announcer skips entirely)
2. Run `/chatid` inside the target topic — bot replies with Chat ID + Topic/Thread ID
3. Set both env vars and redeploy
4. To make the topic bot-only: close the topic in Telegram group settings (only admins/bots can post in closed topics)

**How it works:**

1. First poll seeds `latestTimestamp` and `announcedIds` — no flood on restart
2. Subsequent polls find coins with `timestamp >= latestTimestamp` not in `announcedIds`
3. For each new coin, resolves `tokenURI` via IPFS to get `tweet_url`
4. Posts HTML message: `$TICKER (Name) launched via tweet: <url>` with inline "Buy" button linking to `coins.walletchan.com?buy=<address>`
5. If `COIN_ANNOUNCE_THREAD_ID` is set, passes `message_thread_id` to target the specific topic
6. Announces oldest first (`.reverse()`) for chronological order
7. Prunes `announcedIds` when > 500 entries to prevent unbounded growth
8. Graceful degradation: if IPFS fails, posts without tweet URL; if one coin fails, continues with next

**IPFS resolution** (`src/services/ipfs.ts`):

- Extracts IPFS hash from `ipfs://` URIs or gateway URLs
- Tries Pinata dedicated gateway first (if configured), then `ipfs.io`, then `gateway.pinata.cloud`
- 5s timeout per gateway, returns `{ tweetUrl: null }` on total failure

## Config

`src/config.ts` — Zod schema validates all env vars at startup. Bot won't start with invalid config (except `PRIVATE_GROUP_ID` which is optional for initial `/chatid` setup).

## File Structure

```
src/
├── index.ts              # Entry: starts bot + API + balance checker + coin announcer
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
│   ├── group.ts          # TG group management
│   └── ipfs.ts           # IPFS metadata resolution (tokenURI → tweetUrl)
└── jobs/
    ├── balanceChecker.ts # Periodic balance enforcement
    └── coinAnnouncer.ts  # Coin launch announcements
```
