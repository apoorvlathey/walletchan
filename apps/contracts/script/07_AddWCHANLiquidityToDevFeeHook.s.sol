// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap-periphery/libraries/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap-periphery/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap-periphery/libraries/Actions.sol";
import {ActionConstants} from "@uniswap-periphery/libraries/ActionConstants.sol";
import {GetETHUSDPrice} from "./reporting/GetETHUSDPrice.s.sol";

/**
 * Adds two-sided (WCHAN + WETH) liquidity to the WCHAN/WETH DevFeeHook pool.
 * Handles single-sided edge cases when current price is outside the specified range.
 *
 * Required env vars: DEV_PRIVATE_KEY, BASE_RPC_URL
 * Required in addresses.json:
 *   Chain 8453:    POOL_MANAGER, USDCETHPoolKey (for ETH/USD price)
 *   Current chain: POOL_MANAGER, POSITION_MANAGER, WETH, WCHAN, WCHAN_DEV_FEE_HOOK
 *
 * Dry-run:
 *   cd apps/contracts && source .env && forge script script/07_AddWCHANLiquidityToDevFeeHook.s.sol:AddWCHANLiquidityToDevFeeHook -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 *
 * Broadcast:
 *   cd apps/contracts && source .env && forge script script/07_AddWCHANLiquidityToDevFeeHook.s.sol:AddWCHANLiquidityToDevFeeHook --broadcast -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract AddWCHANLiquidityToDevFeeHook is GetETHUSDPrice {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 constant MAX_ETH_AMOUNT = 0.01 ether;
    uint256 constant MAX_WCHAN_AMOUNT = 1_000_000 ether;
    uint256 constant HARDCODED_TOTAL_SUPPLY = 100_000_000_000 ether; // 100B tokens (OLD_TOKEN supply)

    uint256 constant MIN_MARKETCAP_USD6 = 100_000e6;     // $100K
    uint256 constant MAX_MARKETCAP_USD6 = 15_000_000e6;   // $15M

    int24 constant TICK_SPACING = 60;

    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @dev Intermediate struct to reduce stack depth in run()
    struct MintParams {
        PoolKey poolKey;
        address wchan;
        address weth;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 amount0;  // actual amount0 needed for the liquidity
        uint256 amount1;  // actual amount1 needed for the liquidity
    }

    function run() external override {
        _loadAddresses();

        MintParams memory p = _prepareMintParams();
        require(p.liquidity > 0, "Computed liquidity is zero");

        // Determine actual token amounts
        bool wchanIsC0 = Currency.unwrap(p.poolKey.currency0) == p.wchan;
        uint256 ethNeeded = wchanIsC0 ? p.amount1 : p.amount0;
        uint256 wchanNeeded = wchanIsC0 ? p.amount0 : p.amount1;

        console.log("  ETH needed:", ethNeeded);
        console.log("  WCHAN needed:", wchanNeeded);

        // Check deployer balances before broadcast
        address deployer = vm.addr(vm.envUint("DEV_PRIVATE_KEY"));
        if (wchanNeeded > 0) {
            uint256 wchanBal = IERC20(p.wchan).balanceOf(deployer);
            require(
                wchanBal >= wchanNeeded,
                string.concat(
                    "Insufficient WCHAN. Need: ", vm.toString(wchanNeeded / 1e18),
                    "e18, Have: ", vm.toString(wchanBal / 1e18), "e18"
                )
            );
        }
        if (ethNeeded > 0) {
            require(
                deployer.balance >= ethNeeded,
                string.concat(
                    "Insufficient ETH. Need: ", vm.toString(ethNeeded / 1e18),
                    "e18, Have: ", vm.toString(deployer.balance / 1e18), "e18"
                )
            );
        }

        // Broadcast
        IPositionManager positionManager = IPositionManager(_requireAddress("POSITION_MANAGER"));

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        // Wrap ETH → WETH (only if needed)
        if (ethNeeded > 0) {
            IWETH(p.weth).deposit{value: ethNeeded}();
            console.log("  Wrapped ETH -> WETH:", ethNeeded);
        }

        // Approve tokens via Permit2
        if (wchanNeeded > 0) _approveViaPermit2(p.wchan, wchanNeeded, address(positionManager));
        if (ethNeeded > 0) _approveViaPermit2(p.weth, ethNeeded, address(positionManager));

        // Mint position
        _encodeMintAndExecute(positionManager, p.poolKey, p.tickLower, p.tickUpper, p.liquidity, p.amount0, p.amount1);

        vm.stopBroadcast();

        console.log("");
        console.log("=== LIQUIDITY ADDED ===");
        console.log("  Liquidity:", p.liquidity);
    }

    /// @dev Reads hook state, fetches prices, computes tick range and liquidity. Separate function to avoid stack-too-deep.
    function _prepareMintParams() internal returns (MintParams memory p) {
        IWCHANDevFeeHook hook = IWCHANDevFeeHook(_requireAddress("WCHAN_DEV_FEE_HOOK"));

        // Read pool details from hook
        {
            (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks hooks) = hook.poolKey();
            p.poolKey = PoolKey({ currency0: c0, currency1: c1, fee: fee, tickSpacing: tickSpacing, hooks: hooks });
        }
        p.wchan = hook.wchan();
        p.weth = hook.weth();
        bool wchanIsC0 = !hook.isWethCurrencyZero();

        console.log("--- DevFeeHook Pool ---");
        console.log("  WCHAN:", p.wchan);
        console.log("  WETH:", p.weth);
        console.log("  wchanIsC0:", wchanIsC0);

        // Get ETH/USD price (forks to Base mainnet)
        uint256 ethPriceUsd6 = getEthUsdPrice();
        console.log("  ETH/USD (6 dec):", ethPriceUsd6);

        // Get current pool state (use actual sqrtPriceX96, not tick-derived, for accurate amount calc)
        IPoolManager poolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        (uint160 sqrtPriceX96, int24 currentTick,,) = poolManager.getSlot0(hook.poolId());
        console.log("  Current sqrtPriceX96:", sqrtPriceX96);
        console.log("  Current tick:");
        console.logInt(currentTick);

        // Compute tick range from market cap bounds
        (p.tickLower, p.tickUpper) = _computeTickRange(
            HARDCODED_TOTAL_SUPPLY, MIN_MARKETCAP_USD6, MAX_MARKETCAP_USD6,
            ethPriceUsd6, wchanIsC0, TICK_SPACING
        );
        console.log("  tickLower:");
        console.logInt(p.tickLower);
        console.log("  tickUpper:");
        console.logInt(p.tickUpper);

        // Map max amounts based on currency ordering
        uint256 maxAmount0 = wchanIsC0 ? MAX_WCHAN_AMOUNT : MAX_ETH_AMOUNT;
        uint256 maxAmount1 = wchanIsC0 ? MAX_ETH_AMOUNT : MAX_WCHAN_AMOUNT;

        // Compute liquidity and actual amounts needed (use real sqrtPriceX96 for precision)
        (p.liquidity, p.amount0, p.amount1) = _computeLiquidityAndAmounts(
            sqrtPriceX96, p.tickLower, p.tickUpper, maxAmount0, maxAmount1
        );
        console.log("  liquidity:", p.liquidity);
        console.log("  amount0:", p.amount0);
        console.log("  amount1:", p.amount1);
    }

    // ==========================================
    // Universal Helper Functions
    // ==========================================

    /// @dev Convert a USD market cap (6 decimals) to the corresponding pool tick.
    ///      tokenIsC0 = true means the token (WCHAN) is currency0.
    function _mcapToTick(
        uint256 totalSupply,
        uint256 mcapUsd6,
        uint256 ethPriceUsd6,
        bool tokenIsC0
    ) internal pure returns (int24) {
        // ethAmount = mcapUsd6 * 1e18 / ethPriceUsd6
        uint256 ethAmount = FullMath.mulDiv(mcapUsd6, 1e18, ethPriceUsd6);

        // price = currency1 / currency0
        // tokenIsC0 → price = ethAmount / totalSupply  (WETH is currency1)
        // !tokenIsC0 → price = totalSupply / ethAmount  (TOKEN is currency1)
        uint256 ratioX192 = tokenIsC0
            ? FullMath.mulDiv(ethAmount, uint256(1) << 192, totalSupply)
            : FullMath.mulDiv(totalSupply, uint256(1) << 192, ethAmount);

        return TickMath.getTickAtSqrtPrice(uint160(Math.sqrt(ratioX192)));
    }

    /// @dev Compute tick range from market cap bounds, sorted and rounded to tick spacing.
    function _computeTickRange(
        uint256 totalSupply,
        uint256 minMcapUsd6,
        uint256 maxMcapUsd6,
        uint256 ethPriceUsd6,
        bool tokenIsC0,
        int24 tickSpacing
    ) internal pure returns (int24 tickLower, int24 tickUpper) {
        int24 tickA = _mcapToTick(totalSupply, minMcapUsd6, ethPriceUsd6, tokenIsC0);
        int24 tickB = _mcapToTick(totalSupply, maxMcapUsd6, ethPriceUsd6, tokenIsC0);

        // Sort ticks
        (int24 rawLower, int24 rawUpper) = tickA < tickB ? (tickA, tickB) : (tickB, tickA);

        // Round lower down and upper up to tick spacing
        tickLower = _roundDownToTickSpacing(rawLower, tickSpacing);
        tickUpper = _roundUpToTickSpacing(rawUpper + 1, tickSpacing);
    }

    /// @dev Compute liquidity from max amounts, then derive actual amounts needed.
    ///      Uses the actual sqrtPriceX96 (not tick-derived) for precise amount calculation.
    ///      Handles all 3 cases: below range (token0 only), above range (token1 only), in range (both).
    function _computeLiquidityAndAmounts(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 maxAmount0,
        uint256 maxAmount1
    ) internal pure returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, sqrtLower, sqrtUpper, maxAmount0, maxAmount1
        );

        // Derive actual amounts from the computed liquidity
        if (sqrtPriceX96 <= sqrtLower) {
            // Below range: only token0
            amount0 = _getAmount0ForLiquidity(sqrtLower, sqrtUpper, liquidity);
        } else if (sqrtPriceX96 >= sqrtUpper) {
            // Above range: only token1
            amount1 = _getAmount1ForLiquidity(sqrtLower, sqrtUpper, liquidity);
        } else {
            // In range: both tokens
            amount0 = _getAmount0ForLiquidity(sqrtPriceX96, sqrtUpper, liquidity);
            amount1 = _getAmount1ForLiquidity(sqrtLower, sqrtPriceX96, liquidity);
        }
    }

    /// @dev amount0 = liquidity * (sqrtB - sqrtA) / (sqrtA * sqrtB) * Q96  (rounding up)
    function _getAmount0ForLiquidity(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) internal pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDivRoundingUp(
            FullMath.mulDivRoundingUp(uint256(liquidity), uint256(sqrtB - sqrtA), sqrtB),
            FixedPoint96.Q96,
            sqrtA
        );
    }

    /// @dev amount1 = liquidity * (sqrtB - sqrtA) / Q96  (rounding up)
    function _getAmount1ForLiquidity(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) internal pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDivRoundingUp(uint256(liquidity), uint256(sqrtB - sqrtA), FixedPoint96.Q96);
    }

    /// @dev Approve token → Permit2 → spender if needed
    function _approveViaPermit2(address token, uint256 amount, address spender) internal {
        if (IERC20(token).allowance(msg.sender, PERMIT2) < amount) {
            IERC20(token).approve(PERMIT2, type(uint256).max);
            console.log("  Approved token -> Permit2");
        }
        (uint160 permit2Allowance,,) = IPermit2(PERMIT2).allowance(msg.sender, token, spender);
        if (permit2Allowance < amount) {
            IPermit2(PERMIT2).approve(token, spender, type(uint160).max, uint48(block.timestamp + 1 hours));
            console.log("  Approved Permit2 -> spender");
        }
    }

    /// @dev Encode MINT_POSITION + CLOSE_CURRENCY actions and call PositionManager
    function _encodeMintAndExecute(
        IPositionManager posMgr,
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 amount0Max,
        uint256 amount1Max
    ) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(liquidity),
            uint128(amount0Max),
            uint128(amount1Max),
            ActionConstants.MSG_SENDER,
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        posMgr.modifyLiquidities(abi.encode(actions, params), block.timestamp + 60);
    }

    /// @dev Round tick UP to nearest multiple of tick spacing
    function _roundUpToTickSpacing(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 mod = tick % tickSpacing;
        if (mod == 0) return tick;
        if (tick > 0) return tick + (tickSpacing - mod);
        return tick - mod; // negative: toward zero (up)
    }

    /// @dev Round tick DOWN to nearest multiple of tick spacing
    function _roundDownToTickSpacing(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 mod = tick % tickSpacing;
        if (mod == 0) return tick;
        if (tick > 0) return tick - mod;
        return tick - (tickSpacing + mod); // negative: away from zero (down)
    }
}

interface IWCHANDevFeeHook {
    function poolKey() external view returns (Currency, Currency, uint24, int24, IHooks);
    function poolId() external view returns (PoolId);
    function wchan() external view returns (address);
    function weth() external view returns (address);
    function isWethCurrencyZero() external view returns (bool);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
    function allowance(address user, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

interface IWETH {
    function deposit() external payable;
}
