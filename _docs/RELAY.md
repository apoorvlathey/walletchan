# Relay Swap Provider

Third swap provider alongside 0x and Bungee on the `/swap` page. Relay API calls are made **client-side** (no API key needed), providing another fallback immune to server-side rate limits.

## Architecture

```
User → SwapCard (UI) → useRelayQuote hook → Relay API (direct, client-side)
                                            POST /quote
```

### Why client-side?
- Relay's public API requires **no API key** — calls go directly from the browser
- No server proxy needed (unlike 0x which needs `ZEROX_API_KEY` server-side)
- Fee params (`appFees`) are passed client-side using `NEXT_PUBLIC_SWAP_FEE_RECIPIENT`

## Provider Toggle

SwapCard has a three-button toggle to switch between "0x", "Bungee", and "Relay". All three hooks are always called (React rules of hooks) but only the active one is enabled via the `enabled` param.

**Type**: `SwapProvider = "0x" | "bungee" | "relay"` (defined in `types.ts`)

## Relay API Integration

### Base URL
`https://api.relay.link` (no auth required)

### Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/quote` | POST | Get executable quote with transaction data |

### Quote Request Body

```json
{
  "user": "0x...",
  "originChainId": 8453,
  "destinationChainId": 8453,
  "originCurrency": "0x0000000000000000000000000000000000000000",
  "destinationCurrency": "<buyToken>",
  "amount": "<sellAmount in wei>",
  "tradeType": "EXACT_INPUT",
  "slippageTolerance": "500",
  "appFees": [{ "recipient": "<feeRecipient>", "fee": "90" }]
}
```

| Param | Value | Notes |
|---|---|---|
| `user` | Taker wallet address | Zero address if not connected |
| `originChainId` | `8453` | Base |
| `destinationChainId` | `8453` | Same-chain swap |
| `originCurrency` | `0x0000...0000` | Relay native token format (zero address) |
| `destinationCurrency` | Buy token address | |
| `amount` | Wei string | |
| `tradeType` | `"EXACT_INPUT"` | |
| `slippageTolerance` | Basis points string (e.g. `"500"`) | Same format as our internal slippage |
| `appFees` | Array with recipient + fee in bps | 0.9% integrator fee |

### Response Mapping

Relay responses are mapped to the same `SwapQuote` interface used by 0x and Bungee:

| SwapQuote field | Relay source |
|---|---|
| `buyAmount` | `details.currencyOut.amount` |
| `minBuyAmount` | `details.currencyOut.minimumAmount` |
| `sellAmount` | `details.currencyIn.amount` |
| `liquidityAvailable` | `steps.length > 0` |
| `fees.integratorFee` | `fees.app` (amount, currency address) |
| `route.fills[].source` | `"Relay"` |
| `transaction` | From `steps[0].items[0].data` (the swap/deposit step) |

### Fee Handling

Key differences from 0x and Bungee:

- **App fees are set via `appFees` param** — array of `{recipient, fee}` where fee is in basis points
- **Fees accrue offchain in USDC** — claimable at `relay.link/claim-app-fees`
- **Relay charges their own fee**: 25% of (swap fees + app fees) on top
- **Fee currency**: The `fees.app` object includes its own `currency` with address, symbol, decimals
- The fee amount in the response is in the fee's own currency, not necessarily ETH or the buy token

### Native Token Address

Relay uses `0x0000000000000000000000000000000000000000` (zero address), different from:
- 0x: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (mixed case)
- Bungee: `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` (lowercase)

The hook converts internally — downstream components always see the 0x format (`NATIVE_TOKEN_ADDRESS`).

## Swap Execution Flow (Relay)

1. **Indicative quote** — `useRelayQuote` POSTs to `/quote` (500ms debounce)
2. **User clicks Swap** → `fetchFirmQuote` is called:
   - POSTs a **fresh quote** (quotes expire ~30 seconds)
   - Transaction data is included directly in the quote response `steps` array
   - No separate build-tx call needed (simpler than Bungee)
3. **SwapButton sends transaction** — identical to 0x/Bungee flow (`sendTransactionAsync` with `to`, `data`, `value`)

Since we only support ETH → Token swaps, token approval is never needed.

## File Structure

```
apps/website/app/swap/
├── types.ts                          # SwapQuote interface, SwapProvider type
├── constants.ts                      # RELAY_BASE_URL, RELAY_NATIVE_TOKEN
├── hooks/
│   ├── useRelayQuote.ts             # Relay quote hook (client-side POST calls)
│   ├── useBungeeQuote.ts            # Bungee quote hook
│   └── useSwapQuote.ts              # 0x quote hook
└── components/
    ├── ProviderToggle.tsx            # 0x/Bungee/Relay toggle
    ├── SwapCard.tsx                  # Orchestrates all three hooks
    └── QuoteDisplay.tsx              # Provider-aware fee display
```

## Constants Reference

| Constant | Value | Purpose |
|---|---|---|
| `RELAY_BASE_URL` | `https://api.relay.link` | Public API (no auth) |
| `RELAY_NATIVE_TOKEN` | `0x0000...0000` | Native ETH (zero address) |
