# Coins Page — Real-time Coin Launches

**Route**: `/coins`
**Data source**: Indexer API (configurable via `NEXT_PUBLIC_INDEXER_API_URL`, defaults to `http://localhost:42069`)

---

## Overview

The `/coins` page displays Bankr coin launches in real-time. It fetches an initial batch via REST, then streams new coins via SSE. Follows the Bauhaus design system and mirrors patterns from `/apps`.

---

## Architecture

```
┌─────────────────┐     REST GET /coins      ┌──────────────┐
│                  │ ◄────────────────────── │              │
│   CoinsPage      │     GET /stats           │  Indexer API │
│   (page.tsx)     │ ◄────────────────────── │  :42069      │
│                  │                          │              │
│  useCoinsStream  │     SSE /coins/stream    │              │
│  (hook)          │ ◄═══════════════════════ │              │
└─────────────────┘                          └──────────────┘
```

### Data Flow

1. **Initial load**: `GET /coins?limit=200&offset=0` + `GET /stats` in parallel
2. **SSE connection**: Opens `EventSource` to `/coins/stream?since=<latestTimestamp>`
3. **New coins**: SSE `coin` events are prepended to the list with a yellow highlight animation
4. **Pagination**: `IntersectionObserver` on a sentinel element triggers `loadMore()` which fetches next 200 coins at the correct offset
5. **Reconnection**: On SSE error, reconnects with exponential backoff (1s base, 30s max)

---

## Indexer API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/coins` | GET | Paginated coin list (newest first). Params: `limit` (default 50, max 200), `offset` (default 0) |
| `/coins/creator/:address` | GET | Coins by creator. Same pagination params |
| `/coins/:address` | GET | Single coin by address |
| `/stats` | GET | Returns `{ totalCoins, latestCoin }` |
| `/coins/stream` | GET (SSE) | Real-time stream. Param: `since` (unix timestamp). Events: `coin` with JSON data |

### Coin Data Shape

```typescript
interface Coin {
  id: string;              // Same as coinAddress
  coinAddress: string;     // 0x... contract address
  name: string;            // e.g. "DREAM"
  symbol: string;          // e.g. "DREAM"
  tokenURI: string;        // IPFS or HTTP URI for metadata
  creatorAddress: string;  // 0x... deployer
  blockNumber: string;     // Block number as string
  timestamp: string;       // Unix timestamp as string
  transactionHash: string; // 0x... tx hash
}
```

---

## File Structure

```
apps/website/app/coins/
├── page.tsx                    # Main page component
├── components/
│   └── CoinCard.tsx            # Individual coin card
└── hooks/
    └── useCoinsStream.ts       # SSE + REST data hook
```

### `useCoinsStream` Hook

Returns:
- `coins: Coin[]` — all loaded coins, newest first
- `totalCoins: number` — total count from `/stats`
- `isConnected: boolean` — SSE connection status
- `isLoading: boolean` — true during initial REST fetch
- `isLoadingMore: boolean` — true while fetching next page
- `hasMore: boolean` — false when all coins have been loaded
- `loadMore: () => Promise<void>` — fetch next page of older coins

Key implementation details:
- **SSE offset tracking**: A `sseCountRef` tracks how many coins were prepended via SSE so `loadMore` calculates the correct REST offset
- **Deduplication**: Both SSE handler and `loadMore` deduplicate by coin `id`
- **Reconnection**: Exponential backoff on SSE errors, reconnects with `since=<latestTimestamp>`

### `CoinCard` Component

Displays:
- **$SYMBOL** (with dollar sign prefix, bold uppercase)
- **Name** as subtitle
- **Relative time** (e.g. "2m ago") — simple helper, no date library
- **Token image** from `tokenURI` (fetched as JSON metadata, `image` field)
- Cycles through Bauhaus decorator colors/shapes per index

New coin animation: `@keyframes` that holds yellow (`#F0C020`) for ~1.75s then fades to white over ~0.75s (2.5s total).

### `page.tsx`

- **Header**: "COIN LAUNCHES" with geometric decorators (yellow square + red circle)
- **Live indicator**: Green dot + "LIVE" when SSE connected, gray "CONNECTING..." otherwise
- **Stats badge**: Blue chip showing total coin count
- **Grid**: `SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }}`
- **Infinite scroll**: `IntersectionObserver` with 400px root margin triggers `loadMore`
- **Scroll animations**: Framer Motion `useInView` for staggered card entrance
- **New coin tracking**: `newCoinIds` Set tracks SSE arrivals for highlight animation (cleared after 2.5s)
- **Loading state**: Skeleton cards matching the card layout
- **Empty state**: "No coins found" message

---

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_INDEXER_API_URL` | `http://localhost:42069` | Indexer API base URL |

Set in `apps/website/.env.local` for local development. The constant is exported from `app/constants.ts` as `INDEXER_API_URL`.

---

## Navigation

The "Coins" link is added to the `navLinks` array in `Navigation.tsx`, appearing between "Token" and "Install" on both desktop nav and mobile drawer.
