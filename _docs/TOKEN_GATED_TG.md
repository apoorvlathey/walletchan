# Token-Gated Telegram Bot

## Overview

A Telegram bot that gates access to a private TG group based on sBNKRW staking balance. Users must stake >= X sBNKRW tokens to join and maintain membership.

## Architecture

```
User DMs Bot → /verify → Bot generates UUID token
  → User opens bankrwallet.app/verify?token=xxx
  → Connects wallet (RainbowKit)
  → Sees staked balance (from staking indexer)
  → Signs verification message (EIP-191)
  → Website POSTs to Bot API
  → Bot verifies signature + balance + token
  → Bot generates one-time invite link → DMs user

Background job (every 5min):
  → Checks all members' balances
  → Kicks users below threshold
  → DMs them with re-stake instructions
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| TG Bot + API | `apps/tg-bot` | Grammy bot + Hono API server |
| Verify Page | `apps/website/app/verify/` | Wallet connection + signature UI |
| Staking Indexer | `apps/staking-indexer` | Provides `GET /balances/:address` |

## Database Schema (PostgreSQL + Drizzle)

### `users` table
| Column | Type | Notes |
|--------|------|-------|
| tg_id | bigint | Primary key |
| tg_username | text | Nullable, updated on verify |
| wallet_address | text | UNIQUE — one wallet per TG account |
| verified_at | timestamp | When wallet was linked |
| is_member | boolean | Whether currently in private group |

### `verification_tokens` table
| Column | Type | Notes |
|--------|------|-------|
| token | text | Primary key (UUID) |
| tg_id | bigint | Who requested verification |
| tg_username | text | Nullable |
| expires_at | timestamp | 10 minutes from creation |
| used | boolean | Marked true after successful verify |

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + available commands |
| `/verify` | Generate verification token, send link |
| `/status` | Show wallet, balance, eligibility |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/verify-info?token=xxx` | Validate token, return threshold info |
| POST | `/api/verify` | Complete verification (signature + balance check) |
| GET | `/api/users?limit=&offset=` | List verified users with balances |
| GET | `/api/health` | Health check |

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
Verify Telegram account for BankrWallet
Token: {token}
Timestamp: {unix_timestamp}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram Bot API token | From @BotFather |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://...` |
| `INDEXER_API_URL` | Staking indexer URL | `http://localhost:42070` |
| `PRIVATE_GROUP_ID` | TG group chat ID (negative) | `-1001234567890` |
| `MIN_STAKE_THRESHOLD` | Min sBNKRW in wei (18 decimals) | `1000000000000000000000` (1000) |
| `VERIFY_URL` | Website verify page base URL | `https://bankrwallet.app/verify` |
| `STAKE_URL` | Staking page URL | `https://stake.bankrwallet.app` |
| `PORT` | Hono API port | `3001` |

## Security Considerations

1. **Token is ephemeral** — UUIDs expire in 10 minutes, single-use
2. **tg_id never in URL** — only opaque token exposed to browser
3. **Signature verification** — viem `verifyMessage` with timestamp window (5 min)
4. **1:1 mapping** — UNIQUE constraint on `wallet_address` prevents multi-account gaming
5. **Re-verify updates wallet** — same TG user can link a different wallet (updates existing row)
6. **Balance checked at verify time AND ongoing** — background job re-checks every 5 minutes

## Deployment (Railway)

Single service running Grammy long polling + Hono HTTP server:
- Grammy: long polling (no webhooks needed)
- Hono: HTTP server on `PORT`
- PostgreSQL: Railway managed database
- No external dependencies beyond the staking indexer

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
