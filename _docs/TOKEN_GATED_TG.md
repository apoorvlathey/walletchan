# Token-Gated Telegram Bot

## Overview

A Telegram bot that gates access to a private TG group based on sWCHAN staking balance. Users must stake >= X WCHAN tokens (in the sWCHAN vault) to join and maintain membership.

**Dual-indexer setup (migration from sBNKRW → sWCHAN):**
- **New verifications** require sWCHAN only (via wchan-vault-indexer)
- **Existing members** are checked against both sBNKRW AND sWCHAN (max of the two), so legacy sBNKRW stakers keep access while migrating
- **Grace period**: members below threshold are not kicked immediately — a configurable grace period (default 60 min) gives them time to re-stake

## Architecture

```
User DMs Bot → /verify → Bot generates UUID token
  → User opens walletchan.com/verify?token=xxx
  → Connects wallet (RainbowKit)
  → Sees staked balance (from wchan-vault-indexer)
  → Signs verification message (EIP-191)
  → Website POSTs to Bot API
  → Bot verifies signature + sWCHAN balance + token
  → Bot generates one-time invite link → DMs user

Background job (every 5min):
  → Checks all members' balances (max of sBNKRW + sWCHAN)
  → If below threshold: starts grace period (sets belowThresholdSince)
  → If grace period expired: kicks + DMs with re-stake instructions
  → If recovered: clears grace period
```

## Components

| Component            | Location                   | Purpose                                                   |
| -------------------- | -------------------------- | --------------------------------------------------------- |
| TG Bot + API         | `apps/tg-bot`              | Grammy bot + Hono API server                              |
| Verify Page          | `apps/website/app/verify/` | Wallet connection + signature UI                          |
| WCHAN Vault Indexer  | `apps/wchan-vault-indexer`  | Provides `GET /balances/:address` (sWCHAN, primary)       |
| Staking Indexer      | `apps/staking-indexer`      | Provides `GET /balances/:address` (sBNKRW, legacy compat) |

## Database Schema (PostgreSQL + Drizzle)

### `users` table

| Column                | Type      | Notes                                                |
| --------------------- | --------- | ---------------------------------------------------- |
| tg_id                 | bigint    | Primary key                                          |
| tg_username           | text      | Nullable, updated on verify                          |
| wallet_address        | text      | UNIQUE — one wallet per TG account                   |
| verified_at           | timestamp | When wallet was linked                               |
| is_member             | boolean   | Whether currently in private group                   |
| below_threshold_since | timestamp | Nullable — set when first detected below threshold   |

### `verification_tokens` table

| Column      | Type      | Notes                               |
| ----------- | --------- | ----------------------------------- |
| token       | text      | Primary key (UUID)                  |
| tg_id       | bigint    | Who requested verification          |
| tg_username | text      | Nullable                            |
| expires_at  | timestamp | 10 minutes from creation            |
| used        | boolean   | Marked true after successful verify |

## Bot Commands

| Command   | Description                            |
| --------- | -------------------------------------- |
| `/start`  | Welcome message + available commands   |
| `/verify` | Generate verification token, send link |
| `/status` | Show wallet, balance, eligibility      |

## API Endpoints

| Method | Path                         | Description                                       |
| ------ | ---------------------------- | ------------------------------------------------- |
| GET    | `/api/verify-info?token=xxx` | Validate token, return threshold info             |
| POST   | `/api/verify`                | Complete verification (signature + balance check) |
| GET    | `/api/users?limit=&offset=`  | List verified users with balances                 |
| GET    | `/api/health`                | Health check                                      |

### POST /api/verify — Request Body

```json
{
  "token": "uuid-string",
  "signature": "0x...",
  "address": "0x...",
  "timestamp": 1234567890
}
```

### Verification Message Format

```
Verify Telegram account for WalletChan
Token: {token}
Timestamp: {unix_timestamp}
```

## Environment Variables

| Variable                       | Description                         | Example                         |
| ------------------------------ | ----------------------------------- | ------------------------------- |
| `BOT_TOKEN`                    | Telegram Bot API token              | From @BotFather                 |
| `DATABASE_URL`                 | PostgreSQL connection string        | `postgres://...`                |
| `INDEXER_API_URL`              | sBNKRW staking indexer URL (legacy) | `http://localhost:42070`        |
| `WCHAN_VAULT_INDEXER_API_URL`  | sWCHAN vault indexer URL (primary)  | `http://localhost:42072`        |
| `KICK_GRACE_PERIOD_MINUTES`    | Minutes before kicking below-threshold members | `60`               |
| `PRIVATE_GROUP_ID`             | TG group chat ID (negative)         | `-1001234567890`                |
| `MIN_STAKE_THRESHOLD`          | Min shares in wei (18 decimals)     | `1000000000000000000000` (1000) |
| `VERIFY_URL`                   | Website verify page base URL        | `https://walletchan.com/verify` |
| `STAKE_URL`                    | Staking page URL                    | `https://stake.walletchan.com`  |
| `PORT`                         | Hono API port                       | `3001`                          |

## Security Considerations

1. **Token is ephemeral** — UUIDs expire in 10 minutes, single-use
2. **tg_id never in URL** — only opaque token exposed to browser
3. **Signature verification** — viem `verifyMessage` with timestamp window (5 min)
4. **1:1 mapping** — UNIQUE constraint on `wallet_address` prevents multi-account gaming
5. **Re-verify updates wallet** — same TG user can link a different wallet (updates existing row)
6. **Balance checked at verify time AND ongoing** — background job re-checks every 5 minutes

## Telegram Channel Setup

### Structure

- **Public channel** (`@wchanpublic`) — announcements, anyone can view
- **Private group** — token-gated, only verified holders with sufficient sWCHAN stake (legacy sBNKRW stakers also accepted during migration)

### Posting a Verify Button to the Public Channel

The bot must be added as an **admin** of the public channel (with "Post Messages" permission). Then use the Telegram Bot API to post a message with an inline button:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/sendMessage" \
-H "Content-Type: application/json" \
-d '{
  "chat_id": "@wchanpublic",
  "text": "Want access to the stakers-only group?\n\nStake and hold at least 20M sWCHAN to join.\n\nhttps://stake.walletchan.com/",
  "reply_markup": {
    "inline_keyboard": [[{"text": "✅ Verify & Join", "url": "https://t.me/WalletChanBot?start=verify"}]]
  }
}'
```

Pin this message in the channel. The button opens the bot DM and auto-triggers the verification flow via the `?start=verify` deep link.

### Deep Link

`https://t.me/WalletChanBot?start=verify` — Telegram deep link that opens the bot and auto-runs the verification flow (generates token + sends verify button). Used in the public channel button and on the website's error states.

## Deployment (Railway)

Single service running Grammy long polling + Hono HTTP server:

- Grammy: long polling (no webhooks needed)
- Hono: HTTP server on `PORT`
- PostgreSQL: Railway managed database
- No external dependencies beyond the staking indexer and wchan-vault-indexer

## Key Files

```
apps/tg-bot/
├── src/
│   ├── index.ts              # Entry point: bot + API + background jobs
│   ├── config.ts             # Zod-validated environment variables
│   ├── bot.ts                # Grammy bot commands + handlers
│   ├── api.ts                # Hono API routes
│   ├── db/
│   │   ├── schema.ts         # Drizzle table definitions
│   │   ├── index.ts          # Database connection
│   │   └── migrate.ts        # Migration runner
│   ├── services/
│   │   ├── verification.ts   # Token generation, signature verification
│   │   ├── balance.ts        # Indexer balance fetching
│   │   └── group.ts          # TG group management (invite, kick)
│   └── jobs/
│       └── balanceChecker.ts # Periodic balance enforcement
├── drizzle/                  # Generated migrations
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```
