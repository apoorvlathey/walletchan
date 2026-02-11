# Bungee Swap Provider

Alternative swap provider alongside 0x on the `/swap` page. Bungee API calls are made **client-side** (no API key needed via their public sandbox), making it immune to server-side rate limits.

## Architecture

```
User → SwapCard (UI) → useBungeeQuote hook → Bungee public API (direct, client-side)
                                             GET /api/v1/bungee/quote
                                             GET /api/v1/bungee/build-tx
```

### Why client-side?
- Bungee's public sandbox requires **no API key** — calls go directly from the browser
- No server proxy needed (unlike 0x which needs `ZEROX_API_KEY` server-side)
- Fee params (`feeBps`, `feeTakerAddress`) are passed client-side using `NEXT_PUBLIC_SWAP_FEE_RECIPIENT`

## Provider Toggle

SwapCard has a toggle to switch between "0x" and "Bungee". Both hooks are always called (React rules of hooks) but only the active one is enabled via the `enabled` param. The toggle lives next to the "Swap" heading.

**Type**: `SwapProvider = "0x" | "bungee"` (defined in `types.ts`)

## Bungee API Integration

### Base URL
`https://public-backend.bungee.exchange` (public sandbox, shared rate limits, no auth)

### Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/bungee/quote` | Indicative quote with manual routes |
| `GET /api/v1/bungee/build-tx` | Build executable transaction from a quoteId |

### Quote Parameters

| Param | Value | Notes |
|---|---|---|
| `userAddress` | Taker wallet address | Zero address if not connected |
| `originChainId` | `8453` | Base |
| `destinationChainId` | `8453` | Same-chain swap |
| `inputToken` | `0xeeee...eeee` (all lowercase) | Bungee native token format |
| `outputToken` | Buy token address | |
| `inputAmount` | Wei string | |
| `receiverAddress` | Same as userAddress | |
| `slippage` | Percentage string (e.g. `"5"`) | Converted from bps: `slippageBps / 100` |
| `enableManual` | `"true"` | Required to get `manualRoutes` in response |
| `feeBps` | `"90"` | 0.9% integrator fee |
| `feeTakerAddress` | Fee recipient address | From `NEXT_PUBLIC_SWAP_FEE_RECIPIENT` |

### Build-tx Parameters

| Param | Value |
|---|---|
| `quoteId` | UUID from `manualRoutes[0].quoteId` |

### Response Mapping

Bungee responses are mapped to the same `SwapQuote` interface used by 0x:

| SwapQuote field | Bungee source |
|---|---|
| `buyAmount` | `result.manualRoutes[0].output.amount` |
| `minBuyAmount` | `result.manualRoutes[0].output.minAmountOut` |
| `sellAmount` | `result.input.amount` |
| `liquidityAvailable` | `result.manualRoutes.length > 0` |
| `fees.integratorFee` | Computed from output (see below) |
| `route.fills[].source` | `routeDetails.name` or `"Bungee"` |
| `transaction` | From `build-tx` response `txData` |

### Fee Handling

Key difference from 0x: **Bungee deducts fees from the output token**, while 0x deducts from the sell token (ETH).

- The `buyAmount` returned by Bungee is **post-fee** (fee already deducted)
- Fee amount is reverse-computed for display: `buyAmount * 90 / (10000 - 90)`
- `integratorFee.token` is the **buy token** (not ETH like 0x)
- Bungee charges **no protocol fee** — the entire 0.9% goes to us
- QuoteDisplay handles this: shows fee in buy token for Bungee, ETH for 0x

### Native Token Address

Bungee uses `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` (all lowercase), different from 0x's `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (mixed case). The hook converts internally — downstream components always see the 0x format.

## Swap Execution Flow (Bungee)

1. **Indicative quote** — `useBungeeQuote` fetches from `/api/v1/bungee/quote` (500ms debounce)
2. **User clicks Swap** → `fetchFirmQuote` is called:
   - Fetches a **fresh quote** (quoteIds expire quickly)
   - Calls `/api/v1/bungee/build-tx?quoteId={quoteId}`
   - Returns `SwapQuote` with `transaction` populated
3. **SwapButton sends transaction** — identical to 0x flow (`sendTransactionAsync` with `to`, `data`, `value`)

Since we only support ETH → Token swaps, token approval is never needed for either provider.

## File Structure

```
apps/website/app/swap/
├── types.ts                          # SwapQuote interface, SwapProvider type
├── constants.ts                      # BUNGEE_BASE_URL, BUNGEE_NATIVE_TOKEN
├── hooks/
│   ├── useBungeeQuote.ts             # Bungee quote hook (client-side API calls)
│   └── useSwapQuote.ts               # 0x quote hook (re-exports SwapQuote from types.ts)
└── components/
    ├── ProviderToggle.tsx            # 0x/Bungee toggle (blue active, white inactive)
    ├── SwapCard.tsx                  # Orchestrates both hooks, derives active provider values
    └── QuoteDisplay.tsx              # Provider-aware fee display
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SWAP_FEE_RECIPIENT` | Fee recipient address (client-side, for Bungee) |
| `SWAP_FEE_RECIPIENT` | Same address (server-side, for 0x) |

## Constants Reference

| Constant | Value | Purpose |
|---|---|---|
| `BUNGEE_BASE_URL` | `https://public-backend.bungee.exchange` | Public sandbox API |
| `BUNGEE_NATIVE_TOKEN` | `0xeeee...eeee` (lowercase) | Native ETH for Bungee API |

## Future: Automatic Fallback

The current implementation uses a manual toggle. For automatic fallback:
- When 0x returns an error (rate limit, API failure), switch `provider` state to `"bungee"` automatically
- Don't show error toast for the failed provider — silently fall back
- The architecture already supports this: just change the `provider` state value in SwapCard
