# BankrWallet TG Bot

Token-gated Telegram bot that manages access to a private group based on sBNKRW staked balance.

## Local Development

```bash
# 1. Copy env file and fill in values
cp .env.example .env

# 2. Start PostgreSQL (if not running)
docker run --name bankr-tg-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bankr_tg_bot -p 5432:5432 -d postgres:16

# 3. Install deps (from monorepo root)
pnpm install

# 4. Generate and run migrations
pnpm --filter @bankr-wallet/tg-bot db:generate
pnpm --filter @bankr-wallet/tg-bot db:migrate

# 5. Start bot
pnpm dev:tg-bot
```

To find your group's chat ID, leave `PRIVATE_GROUP_ID` empty, start the bot, add it to the group as admin, then type `/chatid` in the group (admin-only command).

## Deploy to Railway

### 1. Create project

- Go to [railway.app](https://railway.app) → New Project
- Select "Deploy from GitHub repo" → pick the `bankr-wallet` monorepo

### 2. Add PostgreSQL

- Click "+ New" → Database → PostgreSQL
- Railway auto-provisions it and provides `DATABASE_URL`

### 3. Configure the service

**Root Directory:**
```
apps/tg-bot
```

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm run start
```

### 4. Set environment variables

In the service's Variables tab, add:

| Variable | Value |
|----------|-------|
| `BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `INDEXER_API_URL` | Your staking indexer URL (e.g. `https://staking-indexer.up.railway.app`) |
| `PRIVATE_GROUP_ID` | TG group chat ID (negative number) |
| `MIN_STAKE_THRESHOLD` | Min sBNKRW in wei, e.g. `1000000000000000000000` (1000 tokens) |
| `ADMIN_TG_ID` | Your Telegram user ID |
| `VERIFY_URL` | `https://bankrwallet.app/verify` |
| `STAKE_URL` | `https://stake.bankrwallet.app` |
| `PORT` | `3001` (or use Railway's `${{PORT}}`) |

### 5. Run migrations

After the first deploy, open the service's shell (Railway dashboard → service → "Shell" tab):

```bash
npx drizzle-kit migrate
```

Or add a release command in Railway settings:

**Release Command:**
```bash
npx drizzle-kit migrate
```

This runs automatically before each deploy.

### 6. Expose the API

The Hono API needs to be publicly accessible for the website to POST verification results.

- Go to Settings → Networking → Generate Domain
- Railway gives you a `*.up.railway.app` URL
- Set `NEXT_PUBLIC_TG_BOT_API_URL` on the website to this URL

### 7. Bot permissions

The bot needs these permissions in the private TG group (set as admin):
- **Invite Users via Link** — to create one-time invite links
- **Ban Users** — to kick members who fall below threshold

## Architecture

Single Node.js process running three things concurrently:

- **Grammy bot** — long polling (no webhook/public URL needed for the bot)
- **Hono API** — HTTP server for website verification flow
- **Balance checker** — `setInterval` every 5 minutes, kicks users below threshold

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for full technical details.
