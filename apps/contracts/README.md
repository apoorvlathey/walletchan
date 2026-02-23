# Contracts

## WCHANWrapHook

A Uniswap V4 hook that creates a 1:1 swap pool between OLD_TOKEN and WCHAN. The hook fully bypasses the concentrated liquidity AMM — it takes the input from the PoolManager, performs wrap/unwrap via the WCHAN contract, and settles the output back.

### Deployment & Setup

The PoolManager must be pre-funded with both tokens before the first swap can succeed, because `poolManager.take()` does an actual ERC20 transfer during `beforeSwap` — before the swap router settles the user's side.

**Steps:**

1. **Deploy WCHAN** (if not already deployed)

2. **Deploy WCHANWrapHook** at a CREATE2 address whose low 14 bits encode the required hook permission flags:
   - `BEFORE_INITIALIZE_FLAG`
   - `BEFORE_ADD_LIQUIDITY_FLAG`
   - `BEFORE_SWAP_FLAG`
   - `BEFORE_SWAP_RETURNS_DELTA_FLAG`

   Constructor args: `(poolManager, wchan)`

   The constructor validates the address flags and max-approves OLD_TOKEN to WCHAN for wrapping.

3. **Initialize the pool** with fee = 0 and the WCHAN/OLD_TOKEN pair (sorted by address):
   ```
   poolManager.initialize(poolKey, SQRT_PRICE_1_1)
   ```

4. **Pre-fund the PoolManager** with both tokens. The hook calls `poolManager.take(inputCurrency, hook, amount)` during `beforeSwap`, which transfers real tokens from the PM. If the PM doesn't hold enough of the input token, the swap reverts.

   ```
   // Send OLD_TOKEN directly to PoolManager
   oldToken.transfer(address(poolManager), SEED_AMOUNT);

   // Wrap some OLD_TOKEN → WCHAN, then send WCHAN to PoolManager
   oldToken.approve(address(wchan), SEED_AMOUNT);
   wchan.wrap(SEED_AMOUNT);
   wchan.transfer(address(poolManager), SEED_AMOUNT);
   ```

   The seed amount determines the maximum single-swap size. After the first swap, the PM will hold the converted tokens from prior swaps, so the effective capacity grows over time.

### How a Swap Works

1. User sends input token to PM (via swap router)
2. PM calls `hook.beforeSwap()`
3. Hook calls `poolManager.take(inputCurrency, hook, amount)` — receives input tokens
4. Hook calls `wchan.wrap(amount)` or `wchan.unwrap(amount)` — converts 1:1
5. Hook transfers output tokens to PM and calls `poolManager.settle()`
6. Hook returns `BeforeSwapDelta(-amountSpecified, amountSpecified)` to no-op the AMM
7. PM sends output tokens to user (via swap router)

The hook never accumulates tokens — it's a pure pass-through.
