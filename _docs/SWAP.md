# Swap Page

`/swap` route on the website. Allows users to buy any ERC20 token on Base using ETH. Not linked from the navbar — accessed directly or via shareable URLs.

## Architecture

```
User → SwapCard (UI) → useSwapQuote hook → /api/swap/price (Next.js route) → 0x API
                                          → /api/swap/quote (Next.js route) → 0x API
```

### Why server-side API routes?
- **0x API key** (`ZEROX_API_KEY`) stays server-side, never exposed to client
- **Fee params** (`swapFeeRecipient`, `swapFeeBps`, `swapFeeToken`) injected server-side so clients can't bypass or modify fees

## 0x Integration

Uses **0x Swap API v2** with the **AllowanceHolder** flow (single-signature UX, simpler than Permit2).

### Endpoints
| Endpoint | Purpose |
|---|---|
| `/swap/allowance-holder/price` | Indicative quote (read-only, no tx object) |
| `/swap/allowance-holder/quote` | Firm quote with executable transaction object |

### Headers
- `0x-api-key`: Server-side only
- `0x-version`: `v2`

### Fee Collection
- **Fee**: 0.9% (90 bps) charged in ETH (sellToken)
- **Recipient**: `process.env.SWAP_FEE_RECIPIENT`
- **Params**: `swapFeeRecipient`, `swapFeeBps=90`, `swapFeeToken` = native ETH address
- Fee params only added if `SWAP_FEE_RECIPIENT` env var is set
- `swapFeeToken` is hardcoded to `NATIVE_TOKEN` constant server-side (not from client)

### Slippage
- `slippageBps` passed from client → API routes → 0x API
- Default: 500 (5%) — optimized for memecoin trading
- Presets: 1%, 3%, 5%
- Custom input supports any value up to 50%

### Security Notes
- Never approve `transaction.to` (the Settler contract) — only approve `issues.allowance.spender`
- AllowanceHolder address on Base: `0x0000000000001fF3684f28c67538d4D072C22734`
- Native ETH address for 0x: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`

## File Structure

```
apps/website/app/
├── swap/
│   ├── page.tsx                    # Page layout (Bauhaus blue bg, decorators)
│   ├── constants.ts                # Chain ID, fee BPS, token addresses, slippage presets
│   ├── hooks/
│   │   ├── useTokenInfo.ts         # Fetches ERC20 name/symbol/decimals via multicall
│   │   └── useSwapQuote.ts         # Price fetching (debounced), firm quote, formatting
│   └── components/
│       ├── SwapCard.tsx            # Main form: token input, ETH input, output, URL sync
│       ├── SwapButton.tsx          # Swap execution: chain switch → approve → quote → send
│       ├── QuoteDisplay.tsx        # Collapsible quote breakdown (min received, fees, route)
│       └── SlippageSettings.tsx    # Popover with preset buttons + custom input
├── api/swap/
│   ├── price/route.ts              # Proxy to 0x /price endpoint (adds fees + slippage)
│   └── quote/route.ts              # Proxy to 0x /quote endpoint (adds fees + slippage)
```

## Key UI Behaviors

### Quote Fetching
- **Debounced auto-fetch** (500ms) when inputs change — no "Get Quote" button needed
- **No periodic refresh** — minimizes API calls (free tier)
- Quote clears automatically when token or amount changes

### Swap Flow (SwapButton)
1. Switch chain to Base (if needed)
2. Approve token (if ERC20 sell — not needed for ETH)
3. Fetch firm quote from `/api/swap/quote`
4. Send transaction via `sendTransactionAsync`
5. Wait for confirmation, show BaseScan link

### URL Sync
- Token address synced to `?token=` query param
- Read via `window.location.search` on mount (avoids `useSearchParams` + Suspense flash)
- Updated via `window.history.replaceState` on input change
- Enables shareable swap links: `/swap?token=0x...`

### Layout
- Token address input (resolves name + symbol badge)
- "You Pay" ETH input with balance display + Max button
- Down arrow (blue, absolutely positioned between fields)
- "You Receive" read-only output field with slippage gear icon
- Collapsible quote details (min received → expand for fees + route)
- Swap button (red, stays visible during loading with 85% opacity)

### Slippage Settings
- Compact trigger: `"5% slippage ⚙"` text above output field
- Popover (200px wide): 3 preset buttons + custom % input
- Changing slippage triggers quote re-fetch

## Environment Variables

| Variable | Purpose |
|---|---|
| `ZEROX_API_KEY` | 0x API key (server-side only) |
| `SWAP_FEE_RECIPIENT` | Address receiving swap fees |

Both defined in `apps/website/.env.local` (see `.env.local.example`).

## Constants Reference

| Constant | Value | Purpose |
|---|---|---|
| `SWAP_CHAIN_ID` | `8453` | Base chain |
| `FEE_BPS` | `"90"` | 0.9% fee |
| `NATIVE_TOKEN_ADDRESS` | `0xEeee...eEEeE` | Native ETH placeholder for 0x |
| `WETH_ADDRESS` | `0x4200...0006` | WETH on Base |
| `DEFAULT_SLIPPAGE_BPS` | `500` | 5% default slippage |
| `SLIPPAGE_PRESETS` | `[100, 300, 500]` | 1%, 3%, 5% |
