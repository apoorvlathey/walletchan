# WalletChan TG Bot

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
pnpm --filter @walletchan/tg-bot db:generate
pnpm --filter @walletchan/tg-bot db:migrate

# 5. Start bot
pnpm dev:tg-bot
```

To find your group's chat ID, leave `PRIVATE_GROUP_ID` empty, start the bot, add it to the group as admin, then type `/chatid` in the group (admin-only command).

## Deploy to Railway

This is a pnpm monorepo with workspace dependencies, so Railway needs a **Dockerfile** (not the default Nixpacks builder). The repo includes `Dockerfile` and `railway.toml` which handle this automatically.

### 1. Create project

- Go to [railway.app](https://railway.app) → New Project
- Select "Deploy from GitHub repo" → pick the `walletchan` monorepo
- **Do NOT set** Root Directory, Build Command, or Start Command — `railway.toml` handles everything

### 2. Add PostgreSQL

- Click "+ New" → Database → PostgreSQL
- Railway auto-provisions it and provides `DATABASE_URL`

### 3. Generate a public domain

- Go to Settings → Networking → Generate Domain
- Railway gives you a `*.up.railway.app` URL
- The website needs this URL as `NEXT_PUBLIC_TG_BOT_API_URL`

### 4. Set environment variables

In the service's Variables tab, add:

| Variable              | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `BOT_TOKEN`           | From [@BotFather](https://t.me/BotFather)                                |
| `DATABASE_URL`        | `${{Postgres.DATABASE_URL}}` (Railway reference)                         |
| `INDEXER_API_URL`     | Your staking indexer URL (e.g. `https://staking-indexer.up.railway.app`) |
| `PRIVATE_GROUP_ID`    | TG group chat ID (negative number)                                       |
| `MIN_STAKE_THRESHOLD` | Min sBNKRW in wei, e.g. `1000000000000000000000` (1000 tokens)           |
| `ADMIN_TG_ID`         | Your Telegram user ID                                                    |
| `VERIFY_URL`          | `https://walletchan.com/verify`                                          |
| `STAKE_URL`           | `https://stake.walletchan.com`                                           |
| `PORT`                | `3001`                                                                   |

### 5. Run migrations

Railway's internal `DATABASE_URL` (`postgres.railway.internal`) is only reachable from inside their network. To run migrations, use the **public** URL:

1. In Railway dashboard, click your **PostgreSQL** service → **Variables** tab
2. Copy **`DATABASE_PUBLIC_URL`** (not `DATABASE_URL`)
3. Locally, generate and apply migrations:

```bash
cd apps/tg-bot
npx drizzle-kit generate
DATABASE_URL="<paste_DATABASE_PUBLIC_URL>" npx drizzle-kit migrate
```

### 6. Bot permissions

The bot needs these permissions in the private TG group (set as admin):

- **Invite Users via Link** — to create one-time invite links
- **Ban Users** — to kick members who fall below threshold

## Architecture

Single Node.js process running three things concurrently:

- **Grammy bot** — long polling (no webhook/public URL needed for the bot)
- **Hono API** — HTTP server for website verification flow
- **Balance checker** — `setInterval` every 5 minutes, kicks users below threshold

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for full technical details.
