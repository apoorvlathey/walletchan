# WCHANVault APY Indexing

Reference for building an off-chain indexer to compute and display vault APY.

## Yield Channels

The vault has two independent yield streams:

1. **WCHAN yield** — raises the share price (`totalAssets / totalShares`). Sources:
   - `donate()` — direct WCHAN donations
   - Early withdrawal penalty retained portion (50% of penalty stays in vault)

2. **WETH yield** — separate reward token distributed pro-rata via Synthetix accumulator. Source:
   - `donateReward()` — WETH donations

## Events to Index

All three yield-generating events include post-action `totalAssets` and `totalShares`, so the indexer can compute share price purely from event data with no RPC calls.

### `Donate(address indexed sender, uint256 amount, uint256 totalAssets, uint256 totalShares)`

WCHAN donated to vault. Share price increases because `totalAssets` rises while `totalShares` stays constant.

### `DonateReward(address indexed sender, uint256 amount, uint256 totalAssets, uint256 totalShares)`

WETH distributed to all stakers. `totalAssets` is unchanged (WETH is a separate token), but `totalShares` is needed to compute WETH-per-share for the distribution.

### `EarlyWithdrawPenalty(address indexed owner, uint256 penaltyAmount, uint256 burnedAmount, uint256 retainedAmount, uint256 totalAssets, uint256 totalShares)`

Early withdrawal penalty applied. `retainedAmount` stays in vault as yield (increases share price). `burnedAmount` is sent to dead address.

## APY Calculations

### WCHAN APY (share price appreciation)

```
sharePrice = totalAssets / totalShares
wchanAPY = ((sharePriceNow / sharePricePast) - 1) * (365 / daysBetween) * 100
```

Share price only changes on `Donate` and `EarlyWithdrawPenalty` events. Deposits and withdrawals don't change the share price (ERC4626 mints/burns shares proportionally). Dilution from new deposits is automatically captured in slower share price growth.

### WETH APY

```
wethPerShare = DonateReward.amount / DonateReward.totalShares
```

To express as a percentage APY, you need a common denominator (USD):
```
wethAPY = (totalWethDistributed_USD / avgTotalStaked_USD) * (365 / daysBetween) * 100
```

Alternatively, display as "X WETH per 1M WCHAN staked per year" to avoid oracle dependency.

### Net APY

```
netAPY = wchanAPY + wethAPY
```

They're additive: WCHAN yield accrues to share price, WETH yield is a separate claimable stream.

## Indexer Schema

Suggested tables:

```
vault_snapshots:
  - block_number
  - timestamp
  - event_type (donate | donate_reward | penalty)
  - total_assets (uint256, WCHAN in vault)
  - total_shares (uint256, sWCHAN supply)
  - share_price (computed: total_assets / total_shares)
  - wchan_amount (for Donate: amount donated; for Penalty: retainedAmount)
  - weth_amount (for DonateReward: amount distributed)
```

### API Endpoints

```
GET /apy?window=7d
{
  wchanAPY: 12.5,
  wethAPY: 3.2,
  netAPY: 15.7,
  sharePrice: "1.045",
  totalStaked: "1000000000000000000000000"
}

GET /apy/history?interval=1d&from=...&to=...
[
  { timestamp, sharePrice, wchanAPY, wethAPY }
]
```

## Notes

- The ERC4626 standard `Deposit` and `Withdraw` events don't need indexing for APY — they don't change the share price.
- For WETH APY as a percentage, you'll need WCHAN/USD and WETH/USD prices. Options: Uniswap pool TWAP, DEX Screener API, or CoinGecko.
- Rolling windows (7d, 30d) smooth out variance from irregular donation timing.
- The `DripWCHANRewards` contract calls `donate()` and `donateReward()` on a regular schedule, so donation frequency should be predictable.
