# Arb Bot

Zero-capital cross-pool arbitrage bot for WETH↔WCHAN / WETH↔BNKRW on Base. Detects price divergence between the two Uniswap V4 pools and executes atomic 2-leg swaps via the Universal Router. Only ETH for gas is needed — no token capital required.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for full architecture details.

## Setup on Railway

### 1. Create a new service

- Go to your Railway project and click **New** → **GitHub Repo**
- Select this repository
- Railway will auto-detect the `Dockerfile` via `railway.toml`

### 2. Set the root config

In the service **Settings**:

- **Root Directory**: Leave empty (the `railway.toml` at `apps/arb-bot/` points to the Dockerfile from repo root)
- **Watch Paths**: Set to `/apps/arb-bot/**` and `/packages/wchan-swap/**` so deploys only trigger on relevant changes

### 3. Configure environment variables

In the service **Variables** tab, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Bot wallet private key (hex with `0x` prefix). Only needs ETH for gas. |
| `BASE_RPC_URL` | Yes | Base chain RPC endpoint (e.g. Alchemy, QuickNode) |
| `POLL_INTERVAL_MS` | No | Poll interval in ms (default: `2000`, matches Base block time) |
| `MIN_PROFIT_WEI` | No | Minimum net profit in wei after gas (default: `1000000000000` = 0.000001 ETH) |
| `SLIPPAGE_BPS` | No | Slippage tolerance in bps (default: `30` = 0.3%) |
| `DEBUG` | No | Set to any value to enable verbose debug logging |

### 4. Deploy

Railway will build and start the bot automatically. The `railway.toml` configures:

- **Dockerfile**: `apps/arb-bot/Dockerfile`
- **Restart policy**: `ON_FAILURE` with up to 10 retries

### Monitoring

Check Railway logs for output like:

```
[...] INFO === WCHAN/BNKRW Cross-Pool Arb Bot ===
[...] INFO Bot address: 0x...
[...] INFO Balance: 0.01 ETH
[...] INFO Arb opportunity: buy-direct-sell-bnkrw (15 bps divergence)
[...] INFO ARB SUCCESS! Tx: 0x... | Gas used: 0.00001 ETH | Expected net profit: 0.0003 ETH
```

The bot exits after 10 consecutive errors, which triggers Railway's restart policy.

## Local Development

```bash
cp .env.example .env
# Fill in PRIVATE_KEY and BASE_RPC_URL
pnpm dev:arb-bot
```
