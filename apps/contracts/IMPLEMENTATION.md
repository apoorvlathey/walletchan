# WCHANDevFeeHook - Implementation Guide

Uniswap V4 hook on the WCHAN/WETH pool that charges a **1% fee** on every swap. Fees accumulate inside the hook contract. As more users buy WCHAN, the hook's **Internal Swap Pool (ISP)** converts the WCHAN portion of fees into WETH — so the dev earns everything in WETH and can claim it at any time.

## Architecture Overview

```
                                 WCHAN/WETH Pool (Uniswap V4)
                                 +--------------------------+
                                 |       PoolManager        |
                                 +-----+----------+--------+
                                       |          |
                              beforeSwap()    afterSwap()
                                       |          |
                          +------------+----------+-----------+
                          |      WCHANDevFeeHook              |
                          |                                   |
                          |  +-----------------------------+  |
                          |  | Internal Swap Pool (ISP)    |  |
                          |  |                             |  |
                          |  |  pendingFees.wchanAmount    |  |
                          |  |  pendingFees.wethAmount     |  |
                          |  +-----------------------------+  |
                          |                                   |
                          +-----------------------------------+
                                       |
                                  claimFees()
                                       |
                                       v
                                  Dev (WETH)
```

## How Fees Flow

There are two token types that can be collected as fees, depending on swap direction:

| User Action | Fee Currency | Where It Goes |
|-------------|-------------|---------------|
| Buy WCHAN (WETH -> WCHAN) | WETH (unspecified side) | `pendingFees.wethAmount` (claimable) |
| Sell WCHAN (WCHAN -> WETH) | WCHAN (unspecified side) | `pendingFees.wchanAmount` (ISP fuel) |

The fee is always taken from the **unspecified** side of the swap (the side the user didn't fix). This is standard Uniswap V4 hook fee behavior.

## The Internal Swap Pool (ISP)

The ISP is the key mechanism that converts WCHAN fees into WETH for the dev.

### Problem

When users sell WCHAN, the hook collects fees in WCHAN. The dev wants WETH, not WCHAN. Selling that WCHAN on the open market would push the price down.

### Solution

When a **buyer** comes in wanting to swap WETH -> WCHAN, the hook intercepts the swap in `beforeSwap()` and fills part (or all) of the order from the accumulated WCHAN fees, **at the current pool price**. The buyer's WETH goes to `pendingFees.wethAmount` instead of the AMM pool. The remaining order (if any) goes through Uniswap normally.

### ISP Flow (Buy WCHAN)

```
User wants: 10 WETH -> WCHAN
Hook has: 500 WCHAN in pendingFees

beforeSwap():
  1. Check: Is user buying WCHAN? Yes -> continue
  2. Get current pool price (sqrtPriceX96)
  3. Calculate: at current price, 500 WCHAN = ~8 WETH worth
  4. Fill 8 WETH worth from ISP:
     - Take 8 WETH from PoolManager -> hook
     - Settle 500 WCHAN from hook -> PoolManager
     - pendingFees.wethAmount += 8 WETH
     - pendingFees.wchanAmount = 0
  5. Take 1% fee on the ISP portion
  6. Return delta so Uniswap only processes remaining 2 WETH

afterSwap():
  7. Take 1% fee on the Uniswap portion (2 WETH worth)
  8. Emit events
```

### ISP Flow (Sell WCHAN)

```
User wants: WCHAN -> WETH
Hook has: doesn't matter

beforeSwap():
  1. Check: Is user buying WCHAN? No -> skip ISP (return early)

afterSwap():
  2. Take 1% fee in WCHAN (unspecified side)
  3. pendingFees.wchanAmount += fee
  4. This WCHAN is now ISP fuel for the next buyer
```

## Swap Lifecycle

```
             +-----------+
             |   Swap    |
             |  Request  |
             +-----+-----+
                   |
                   v
         +-------------------+
         |   beforeSwap()    |   src/WCHANDevFeeHook.sol:189
         +--------+----------+
                  |
         Is user buying WCHAN?
        /                    \
      Yes                    No
       |                      |
       v                      v
+------------------+   (skip ISP, pass
| _internalSwap()  |    through to Uniswap)
| src:360           |
+--------+---------+
         |
   Has pending WCHAN?
   /              \
  Yes              No
   |                |
   v                v
Calculate fill    (return 0,0)
amount at current
pool price
   |
   v
Take WETH from PM,
Settle WCHAN to PM
   |
   v
Take 1% fee on ISP portion
(_takeFeesFromUnspecifiedAmount, src:445)
   |
   v
Return adjusted BeforeSwapDelta
(reduces Uniswap swap amount)
         |
         v
+-------------------+
|  Uniswap V4 AMM   |  (processes remaining amount)
+--------+----------+
         |
         v
+-------------------+
|   afterSwap()     |   src:254
+--------+----------+
         |
Take 1% fee on Uniswap portion
(_takeFeesFromUnspecifiedAmount, src:445)
         |
         v
Emit PoolSwap + HookSwap/HookFee events
         |
         v
Flush transient storage
```

## Key Functions Reference

### Core Hooks

| Function | Line | Purpose |
|----------|------|---------|
| `beforeSwap()` | 189 | Entry point. Runs ISP if user is buying WCHAN, adjusts swap delta |
| `afterSwap()` | 254 | Takes 1% fee on the Uniswap portion, emits events, flushes tstore |
| `beforeInitialize()` | 174 | Always reverts. Prevents anyone else from initializing a pool with this hook |

### Internal Logic

| Function | Line | Purpose |
|----------|------|---------|
| `_internalSwap()` | 360 | Core ISP logic. Calculates fill amount from pending WCHAN at current price using `SwapMath.computeSwapStep()` |
| `_takeFeesFromUnspecifiedAmount()` | 445 | Calculates 1% fee, takes it from PoolManager, updates `pendingFees` |
| `_determineCurrencyWithUnspecifiedAmount()` | 471 | Resolves which token (WETH or WCHAN) is on the unspecified side |
| `_determineUnspecifiedAmountAfterSwap()` | 498 | Extracts the unspecified amount from the afterSwap delta |

### Admin / External

| Function | Line | Purpose |
|----------|------|---------|
| `initialize()` | 129 | Owner-only. Initializes the Uniswap V4 pool with a starting price |
| `claimFees()` | 318 | Callable by anyone. Sends accumulated WETH to `dev` address |
| `updateDevAddress()` | 336 | Owner-only. Changes the `dev` fee recipient |

## Fee Calculation

```
swapFee = swapAmount * 100 / 10000  =  1%
```

Defined at line 40:
```solidity
uint24 public constant DEV_FEE_IN_BPS = 1_00;           // 1%
uint256 internal constant ONE_HUNDRED_PERCENT_IN_BPS = 100_00;  // 100%
```

Fees are always taken from the **unspecified** side of the swap (the token amount the user did NOT fix). This applies to both the ISP portion and the Uniswap portion independently.

## State

```solidity
struct PendingFees {
    uint256 wethAmount;    // Claimable by dev via claimFees()
    uint256 wchanAmount;   // ISP fuel, used to fill future buy orders
}
```

Both fields increase when fees are collected. `wchanAmount` decreases when the ISP fills a buy order (converting it to `wethAmount`). `wethAmount` resets to 0 when `claimFees()` is called.

```
          Sell WCHAN                      Buy WCHAN
         (fee in WCHAN)                  (ISP fills order)
              |                               |
              v                               v
     pendingFees.wchanAmount ----ISP----> pendingFees.wethAmount
                                              |
                                         claimFees()
                                              |
                                              v
                                          Dev wallet
```

## Transient Storage (EIP-1153)

Per-swap accounting data is stored in transient storage (`tstore`/`tload`) to save gas. This data only lives for the duration of the transaction and is used to emit accurate events in `afterSwap()`.

| Key | Purpose |
|-----|---------|
| `TS_ISP_AMOUNT0/1` | Token amounts filled by ISP |
| `TS_ISP_FEE0/1` | Fee amounts from ISP portion |
| `TS_UNI_FEE0/1` | Fee amounts from Uniswap portion |

All values are flushed to zero at the end of `afterSwap()` (line 301-308).

## Pool Configuration

Set in the constructor (line 106-113):

```solidity
PoolKey({
    currency0: <lower address of WETH/WCHAN>,
    currency1: <higher address of WETH/WCHAN>,
    fee: 0,              // No LP fee (hook handles all fees)
    tickSpacing: 60,
    hooks: address(this)
})
```

The pool has **zero LP fee** — all fee revenue goes to the dev via the hook's 1% take.

## Events

| Event | When |
|-------|------|
| `InternalSwap(zeroForOne, wethIn, wchanOut)` | ISP fills a buy order |
| `SwapFeesReceived(wethAmount, wchanAmount)` | 1% fee collected (either token) |
| `PoolSwap(isp0, isp1, ispFee0, ispFee1, uni0, uni1, uniFee0, uniFee1)` | Full swap breakdown per swap |
| `WethClaimed(dev, amount)` | Dev claims accumulated WETH |
| `HookSwap` / `HookFee` | Standardized Uniswap V4 events (via `UniswapHookEvents.sol`) |

## Deployment

The hook address must encode the correct permission flags in its lowest 14 bits. This is achieved via CREATE2 salt mining (see `script/03_DeployWCHANDevFeeHook.s.sol`).

```bash
# Deploy (after WCHAN and WrapHook are deployed)
forge script script/03_DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook \
  --broadcast --verify
```

Constructor args: `dev`, `initialOwner`, `poolManager`, `wchan`, `weth`

After deployment, the owner calls `initialize(sqrtPriceX96)` to create the pool.
