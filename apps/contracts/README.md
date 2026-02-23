# Contracts

Solidity smart contracts for WCHAN token, built with [Foundry](https://book.getfoundry.sh/).

## Setup

```bash
cp .env.example .env
# Fill in DEV_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
```

## Deploy Scripts

Scripts are numbered and form a dependency chain (`00` -> `01` -> `02` -> `03`). Deployed addresses are read from and written to `addresses.json` keyed by chain ID.

| Script | Contract | Notes |
| --- | --- | --- |
| `00_DeployMockOldToken` | MockOldToken | Testnet only |
| `01_DeployWCHAN` | WCHAN / WCHANTestnet | Vanity CREATE2 address (see below) |
| `02_DeployWCHANWrapHook` | WCHANWrapHook | Uniswap v4 hook |
| `03_DeployWCHANDevFeeHook` | WCHANDevFeeHook | Uniswap v4 hook |

Deploy a script:

```bash
cd apps/contracts && source .env
forge script script/01_DeployWCHAN.s.sol:DeployWCHAN --broadcast --verify -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
```

## WCHAN Vanity Address

WCHAN is deployed via CREATE2 to a vanity address starting with `0xBA5ED...`. The flow uses [ERADICATE2](https://github.com/apoorvlathey/ERADICATE2) (GPU-accelerated OpenCL) to mine a salt that produces the desired address prefix.

### How it works

1. Foundry's `new Contract{salt: salt}(args)` routes through the [deterministic deployer](https://github.com/Arachnid/deterministic-deployment-proxy) at `0x4e59b44847b379578588920cA78FbF26c0B4956C`
2. The resulting address is: `keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code))[12:]`
3. ERADICATE2 brute-forces salts on GPU until it finds one where the address matches the desired prefix

### Mining a vanity salt

```bash
cd apps/contracts

# Build ERADICATE2 (first time only)
make -C lib/ERADICATE2

# Mine a salt (computes init code, then runs ERADICATE2)
./script/process/mine_vanity.sh base-sepolia
./script/process/mine_vanity.sh base
```

The script:
1. Runs `GetInitCodeHash.s.sol` via Forge to compute the contract's init code and save it to a `.hex` file
2. Launches ERADICATE2 with the init code file, deployer address, and target prefix
3. Prints matching salts and addresses as they're found

### After mining

Once you have a salt with a satisfactory address, add both to `addresses.json` under the target chain:

```json
{
  "84532": {
    "WCHAN_SALT": "0x<salt from ERADICATE2>",
    "EXPECTED_WCHAN_ADDRESS": "0x<address from ERADICATE2>",
    ...
  }
}
```

Then deploy:

```bash
source .env && forge script script/01_DeployWCHAN.s.sol:DeployWCHAN --broadcast --verify -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
```

The deploy script verifies the deployed address matches `EXPECTED_WCHAN_ADDRESS` and reverts on mismatch.

## Build & Test

```bash
forge build
forge test
```

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
