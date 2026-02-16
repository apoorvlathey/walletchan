# Staking Indexer Implementation

Ponder-based indexer for the sBNKRW ERC-4626 vault on Base. Tracks Deposit, Withdraw, and Transfer events to maintain accurate per-user staked balances.

## Contract

- **sBNKRW Vault**: `0x7ac242481d5122c4d3400492af6adfbce21d7113` (Base)
- **Type**: ERC-4626 tokenized vault
- **Start Block**: `41983697`
- **Underlying**: BNKRW token (`0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07`)

## Architecture

### Why Track Transfer Events

Deposit/Withdraw events alone miss direct sBNKRW token transfers between users. Since Deposit emits `Transfer(0x0 → owner)` and Withdraw emits `Transfer(owner → 0x0)`, balances are derived purely from Transfer events. Deposit/Withdraw are stored separately as rich historical events (with `assets`, `sender`, `receiver` fields).

### Separate App

This is a standalone indexer (`apps/staking-indexer/`) rather than an addition to `apps/indexer/`. Reasons:
- Independent reindexing without affecting coin launch indexer
- Separate scaling and deployment
- Different RPC usage patterns (vault events are low-volume)

## File Structure

```
apps/staking-indexer/
├── abis/
│   └── ERC4626VaultAbi.ts     # Deposit, Withdraw, Transfer event ABIs
├── src/
│   ├── index.ts               # Event handlers (Deposit, Withdraw, Transfer)
│   └── api/
│       └── index.ts           # REST + GraphQL API endpoints
├── ponder.config.ts           # Base chain config, vault contract
├── ponder.schema.ts           # vault_event + user_balance tables
├── ponder-env.d.ts            # Ponder virtual module types
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Schema

### `vault_event`
Stores every Deposit and Withdraw event with full context.

| Column          | Type    | Description                              |
| --------------- | ------- | ---------------------------------------- |
| id              | text PK | `{txHash}-{logIndex}`                    |
| eventType       | text    | `"deposit"` or `"withdraw"`              |
| sender          | hex     | Address that initiated the tx            |
| owner           | hex     | Address that owns the deposited shares   |
| receiver        | hex     | Withdraw receiver (null for deposits)    |
| assets          | bigint  | Underlying token amount                  |
| shares          | bigint  | Vault share amount                       |
| blockNumber     | bigint  |                                          |
| timestamp       | bigint  |                                          |
| transactionHash | hex     |                                          |

Indexes: `owner`, `timestamp`, `eventType`

### `user_balance`
Current staked balance per user, updated on every Transfer event.

| Column               | Type    | Description                        |
| -------------------- | ------- | ---------------------------------- |
| id                   | text PK | Lowercased address                 |
| shares               | bigint  | Current vault share balance        |
| lastUpdatedBlock     | bigint  | Block of last balance change       |
| lastUpdatedTimestamp  | bigint  | Timestamp of last balance change   |

## Event Handlers

### `sBNKRWVault:Deposit`
Inserts a `vault_event` row with `eventType: "deposit"`. Uses `onConflictDoNothing` for idempotency.

### `sBNKRWVault:Withdraw`
Inserts a `vault_event` row with `eventType: "withdraw"`. Uses `onConflictDoNothing` for idempotency.

### `sBNKRWVault:Transfer`
Updates `user_balance` for both sides of the transfer:
- **From address** (skip if `0x0` mint): decrement shares
- **To address** (skip if `0x0` burn): increment shares

Uses read-then-upsert pattern (`find` → `insert`/`onConflictDoUpdate`). Ponder processes events sequentially so no race conditions.

## API Endpoints

Port: **42070** (coin launch indexer uses 42069)

| Endpoint              | Method | Description                                           |
| --------------------- | ------ | ----------------------------------------------------- |
| `/balances/:address`  | GET    | Single user's staked balance (returns `shares: "0"` if unknown) |
| `/balances`           | GET    | All users with non-zero balance, paginated, ordered by shares desc |
| `/events/:address`    | GET    | User's deposit/withdraw history                       |
| `/events`             | GET    | All deposit/withdraw events, optional `?type=deposit\|withdraw` filter |
| `/stats`              | GET    | Unique stakers count, total shares, total events      |
| `/graphql`            | POST   | Auto-generated GraphQL from schema                    |

### Query Parameters

- `limit` (default: 50, max: 200) — pagination limit
- `offset` (default: 0) — pagination offset
- `type` (optional, events only) — filter by `"deposit"` or `"withdraw"`

### Response Format

All BigInt values are serialized as strings (via `replaceBigInts` helper).

## Shared Constants

Contract addresses are centralized in `packages/shared/src/contracts.ts`:

```typescript
import { SBNKRW_VAULT_ADDRESS } from "@bankr-wallet/shared/contracts";
```

This is the single source of truth shared between the indexer, the website staking page, and the API routes.

## Running

```bash
# Development (port 42070)
pnpm dev:staking-indexer

# Production
pnpm start:staking-indexer
```

### Environment Variables

Copy `.env.example` to `.env.local`:

| Variable             | Required | Description                                |
| -------------------- | -------- | ------------------------------------------ |
| `PONDER_RPC_URL_8453`| Yes      | Base RPC URL (same as coin launch indexer)  |
| `DATABASE_URL`       | No       | PostgreSQL URL (uses PGlite locally)       |

## Use Cases

### Token-Gating Bot
Query `/balances` to get all stakers ordered by shares. Compare against threshold to determine eligibility. Poll periodically or build a webhook on top.

### User Staking Dashboard
Query `/balances/:address` for current balance, `/events/:address` for transaction history.

### Analytics
Query `/stats` for aggregate metrics.
