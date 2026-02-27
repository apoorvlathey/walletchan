# Drip APY Preview UI

Reference for building a UI that previews estimated APY when configuring a new drip or topping up an existing one. No indexer needed — everything is from RPC reads + client-side math.

## RPC Reads Required

| Call | Returns | Purpose |
|------|---------|---------|
| `vault.totalAssets()` | uint256 | Total WCHAN staked in vault |
| `vault.totalSupply()` | uint256 | Total sWCHAN shares outstanding |
| `drip.wchanStream()` | (startTimestamp, endTimestamp, lastDripTimestamp, amountRemaining) | Active WCHAN stream state |
| `drip.wethStream()` | (startTimestamp, endTimestamp, lastDripTimestamp, amountRemaining) | Active WETH stream state |

## WCHAN APY Preview (New Stream)

When no active stream exists (or existing stream is fully drained):

```
Inputs: wchanAmount, startTime, endTime
duration = endTime - startTime

currentSharePrice = totalAssets / totalSupply

// Annualize the rate at which share price grows from drip
dailyDrip = wchanAmount / duration * 86400
annualDrip = dailyDrip * 365
wchanAPY = (annualDrip / totalAssets) * 100
```

## WCHAN APY Preview (Top-Up)

When topping up an active stream, `configureDrip` is additive: `amountRemaining += amount`, and `endTimestamp` only extends (never shortens). The UI must account for the existing stream:

```
Inputs: topUpAmount, newEndTimestamp

// Read current stream state
stream = drip.wchanStream()

// configureDrip settles pending drip first, so simulate that
elapsed = now - stream.lastDripTimestamp
if (now >= stream.endTimestamp) {
  pendingDrip = stream.amountRemaining
} else {
  remainingDuration = stream.endTimestamp - stream.lastDripTimestamp
  pendingDrip = stream.amountRemaining * elapsed / remainingDuration
}
settledRemaining = stream.amountRemaining - pendingDrip

// After settlement: additive amount, only-extend end
effectiveAmount = settledRemaining + topUpAmount
effectiveEnd = max(stream.endTimestamp, newEndTimestamp)
effectiveDuration = effectiveEnd - now

// APY from combined stream
dailyDrip = effectiveAmount / effectiveDuration * 86400
annualDrip = dailyDrip * 365
wchanAPY = (annualDrip / totalAssets) * 100
```

## WETH APY Preview

Same pattern but with `wethStream()`. To express as a percentage APY, a common denominator (USD) is needed:

```
wethDailyDrip = wethAmount / duration * 86400
wethAnnualDrip = wethDailyDrip * 365
wethAPY = (wethAnnualDrip * wethPrice) / (totalAssets * wchanPrice) * 100
```

Price sources: Uniswap pool TWAP, DEX Screener API, or CoinGecko.

Alternatively, display as "X WETH per 1M WCHAN staked per year" to avoid oracle dependency.

## Net APY

```
netAPY = wchanAPY + wethAPY
```

## Important Notes

- These are estimates assuming current `totalAssets` stays constant. In practice, new deposits dilute APY (more stakers sharing the same drip rate) and withdrawals concentrate it.
- The `MIN_DRIP_INTERVAL` (1 hour) means drips are discrete, not continuous. APY is an annualized projection of the average rate.
- Early withdrawal penalties also contribute to WCHAN yield (retained portion), but this is unpredictable and not included in the estimate.
