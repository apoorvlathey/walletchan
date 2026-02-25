// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap-periphery/libraries/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap-periphery/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap-periphery/libraries/Actions.sol";
import {ActionConstants} from "@uniswap-periphery/libraries/ActionConstants.sol";
import {GetOldTokenPoolInfo} from "./reporting/GetOldTokenPoolInfo.s.sol";

/**
 * Creates TOKEN/WETH pools and provides single-sided token liquidity so the
 * PoolManager holds both WCHAN and OLD_TOKEN (needed by WCHANWrapHook).
 *
 * Handles both currency orderings (token < WETH or token > WETH) automatically.
 *
 * Required in addresses.json: POOL_MANAGER, POSITION_MANAGER, WETH, WCHAN, OLD_TOKEN
 *
 * Dry-run:
 *   cd apps/contracts && source .env && forge script script/05_ProvideLiquidityForWrapHook.s.sol:ProvideLiquidity -vvvv --rpc-url $BASE_RPC_URL
 *   cd apps/contracts && source .env && forge script script/05_ProvideLiquidityForWrapHook.s.sol:ProvideLiquidity -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 *
 * Broadcast:
 *   cd apps/contracts && source .env && forge script script/05_ProvideLiquidityForWrapHook.s.sol:ProvideLiquidity --broadcast -vvvv --rpc-url $BASE_RPC_URL
 *   cd apps/contracts && source .env && forge script script/05_ProvideLiquidityForWrapHook.s.sol:ProvideLiquidity --broadcast -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract ProvideLiquidity is GetOldTokenPoolInfo {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    int24 constant TICK_SPACING = 60;

    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint256 constant SEED_AMOUNT_WCHAN = 899404600 ether;
    uint256 constant SEED_AMOUNT_OLD_TOKEN = 0 ether;

    // Note: WCHAN's totalSupply() now returns the full 100B (pre-minted to contract).

    IPoolManager poolManager;
    IPositionManager positionManager;
    address weth;

    uint256 ethPriceRaw; // USD per ETH, 6 decimals (fetched from Base USDC/ETH pool)
    uint256 tokenMcapUsd6; // OLD_TOKEN market cap in USD, 6 decimals (fetched from pool)

    function run() external override {
        _loadAddresses();

        // Fetch live ETH/USD price and OLD_TOKEN market cap
        (tokenMcapUsd6, ethPriceRaw) = _getOldTokenMcapUsd6();
        console.log("--- Live Price Data ---");
        console.log("  ETH/USD (6 dec):", ethPriceRaw);
        console.log("  OLD_TOKEN mcap USD (6 dec):", tokenMcapUsd6);

        poolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        positionManager = IPositionManager(_requireAddress("POSITION_MANAGER"));
        weth = _requireAddress("WETH");

        address wchan = _requireAddress("WCHAN");
        address oldToken = _requireAddress("OLD_TOKEN");

        uint256 deployerPk = vm.envUint("DEV_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        // Check balances before broadcast; returns amount of OLD_TOKEN to wrap into WCHAN
        uint256 toWrap = _checkBalances(wchan, oldToken, deployer);

        vm.startBroadcast(deployerPk);

        // Wrap OLD_TOKEN → WCHAN if deployer doesn't have enough WCHAN
        if (toWrap > 0) {
            console.log("Wrapping OLD_TOKEN -> WCHAN:", toWrap / 1e18);
            IERC20(oldToken).approve(wchan, toWrap);
            IWCHAN(wchan).wrap(toWrap);
        }

        _provideLiquidityForToken(wchan, SEED_AMOUNT_WCHAN, "WCHAN");
        // FIXME: for testnet uncomment this, on base mainnet we already have sufficient tokens in the pool
        // _provideLiquidityForToken(oldToken, SEED_AMOUNT_OLD_TOKEN, "OLD_TOKEN");

        vm.stopBroadcast();
    }

    /// @dev Verify deployer has enough OLD_TOKEN for wrapping + seeding. Returns amount to wrap.
    function _checkBalances(address wchan, address oldToken, address deployer) internal view returns (uint256 toWrap) {
        uint256 wchanBal = IERC20(wchan).balanceOf(deployer);
        uint256 oldTokenBal = IERC20(oldToken).balanceOf(deployer);
        uint256 oldTokenNeeded = SEED_AMOUNT_OLD_TOKEN;

        if (wchanBal < SEED_AMOUNT_WCHAN) {
            toWrap = SEED_AMOUNT_WCHAN - wchanBal;
            oldTokenNeeded += toWrap;
        }

        require(
            oldTokenBal >= oldTokenNeeded,
            string.concat(
                "Insufficient OLD_TOKEN. Have: ", vm.toString(oldTokenBal / 1e18),
                "e18, Need: ", vm.toString(oldTokenNeeded / 1e18),
                "e18 (", vm.toString(toWrap / 1e18), "e18 to wrap + ",
                vm.toString(SEED_AMOUNT_OLD_TOKEN / 1e18), "e18 for OLD_TOKEN pool)"
            )
        );
    }

    function _provideLiquidityForToken(address token, uint256 seedAmount, string memory label) internal {
        console.log(string.concat("--- ", label, " ---"));

        bool tokenIsC0 = token < weth;

        // 1. Calculate sqrtPriceX96 (depends on currency ordering)
        uint160 sqrtPriceX96 = _calculateSqrtPrice(token, tokenIsC0);

        // 2. Build pool key (sorted currencies, no hooks, 1% fee)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(tokenIsC0 ? token : weth),
            currency1: Currency.wrap(tokenIsC0 ? weth : token),
            fee: 10_000,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // 3. Initialize pool if needed
        sqrtPriceX96 = _initializeIfNeeded(poolKey, sqrtPriceX96);

        // 4. Approve token → Permit2 → PositionManager (skip if already approved)
        if (IERC20(token).allowance(msg.sender, PERMIT2) < seedAmount) {
            IERC20(token).approve(PERMIT2, type(uint256).max);
            console.log("  Approved token -> Permit2");
        }
        (uint160 permit2Allowance,,) = IPermit2(PERMIT2).allowance(msg.sender, token, address(positionManager));
        if (permit2Allowance < seedAmount) {
            IPermit2(PERMIT2).approve(token, address(positionManager), type(uint160).max, uint48(block.timestamp + 1 hours));
            console.log("  Approved Permit2 -> PositionManager");
        }

        // 5. Mint single-sided TOKEN position
        _mintPosition(poolKey, sqrtPriceX96, seedAmount, tokenIsC0);

        console.log("  Liquidity provided successfully");
    }

    /// @dev Returns the on-chain totalSupply for the given token.
    function _getEffectiveTotalSupply(address token, address) internal view returns (uint256) {
        return IERC20(token).totalSupply();
    }

    /// @dev Calculate sqrtPriceX96 from tokenMcapUsd6 and ethPriceRaw (fetched live).
    ///      sqrtPriceX96 = sqrt(currency1_amount * 2^192 / currency0_amount)
    function _calculateSqrtPrice(address token, bool tokenIsC0) internal view returns (uint160) {
        uint256 totalSupply = _getEffectiveTotalSupply(token, _requireAddress("WCHAN"));
        uint256 ethAmount = FullMath.mulDiv(tokenMcapUsd6, 1e18, ethPriceRaw);

        // price = currency1 / currency0
        // tokenIsC0 → price = ethAmount / totalSupply  (WETH is currency1)
        // !tokenIsC0 → price = totalSupply / ethAmount  (TOKEN is currency1)
        uint256 ratioX192 = tokenIsC0
            ? FullMath.mulDiv(ethAmount, uint256(1) << 192, totalSupply)
            : FullMath.mulDiv(totalSupply, uint256(1) << 192, ethAmount);
        uint160 sqrtPriceX96 = uint160(Math.sqrt(ratioX192));

        console.log("  totalSupply:", totalSupply);
        console.log("  ethAmount (wei):", ethAmount);
        console.log("  sqrtPriceX96:", sqrtPriceX96);
        console.log("  tokenIsC0:", tokenIsC0);

        return sqrtPriceX96;
    }

    /// @dev Initialize pool if not already initialized; returns effective sqrtPriceX96
    function _initializeIfNeeded(PoolKey memory poolKey, uint160 sqrtPriceX96) internal returns (uint160) {
        (uint160 existing,,,) = poolManager.getSlot0(poolKey.toId());
        if (existing == 0) {
            poolManager.initialize(poolKey, sqrtPriceX96);
            console.log("  Pool initialized");
            return sqrtPriceX96;
        }
        console.log("  Pool already initialized, using existing price");
        return existing;
    }

    // Seed range corresponds to $1B–$2B market cap — far from current mcap,
    // but in a normal sqrtPrice range that avoids uint128 overflow and max-liquidity-per-tick limits.
    uint256 constant RANGE_MCAP_LOW_USD6 = 1_000_000_000e6; // $1B (6 decimals)
    uint256 constant RANGE_MCAP_HIGH_USD6 = 2_000_000_000e6; // $2B (6 decimals)

    /// @dev Mint single-sided TOKEN position in the $1B–$2B mcap tick range.
    ///      Far enough from current price that normal trading won't convert tokens,
    ///      but in a reasonable sqrtPrice range that avoids math overflow.
    function _mintPosition(PoolKey memory poolKey, uint160 sqrtPriceX96, uint256 seedAmount, bool tokenIsC0) internal {
        (int24 tickLower, int24 tickUpper) = _seedTickRange(poolKey, tokenIsC0);

        uint128 liquidity;
        if (tokenIsC0) {
            liquidity = LiquidityAmounts.getLiquidityForAmount0(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), seedAmount
            );
        } else {
            liquidity = LiquidityAmounts.getLiquidityForAmount1(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), seedAmount
            );
        }

        console.log("  initialTick:");
        console.logInt(TickMath.getTickAtSqrtPrice(sqrtPriceX96));
        console.log("  tickLower:");
        console.logInt(tickLower);
        console.log("  tickUpper:");
        console.logInt(tickUpper);
        console.log("  liquidity:", liquidity);

        _encodeMintAndExecute(poolKey, tickLower, tickUpper, liquidity, seedAmount, tokenIsC0);
    }

    /// @dev Compute tick range from RANGE_MCAP_LOW and RANGE_MCAP_HIGH for the given token.
    function _seedTickRange(PoolKey memory poolKey, bool tokenIsC0) internal view returns (int24 tickLower, int24 tickUpper) {
        address token = Currency.unwrap(tokenIsC0 ? poolKey.currency0 : poolKey.currency1);
        uint256 totalSupply = _getEffectiveTotalSupply(token, _requireAddress("WCHAN"));

        int24 tickA = _mcapToTick(totalSupply, RANGE_MCAP_LOW_USD6, tokenIsC0);
        int24 tickB = _mcapToTick(totalSupply, RANGE_MCAP_HIGH_USD6, tokenIsC0);

        // Ensure tickLower < tickUpper (ordering flips depending on tokenIsC0)
        (int24 rawLower, int24 rawUpper) = tickA < tickB ? (tickA, tickB) : (tickB, tickA);
        tickLower = _roundDownToTickSpacing(rawLower);
        tickUpper = _roundUpToTickSpacing(rawUpper + 1);
    }

    /// @dev Convert a USD market cap (6 decimals) to the corresponding pool tick.
    function _mcapToTick(uint256 totalSupply, uint256 mcapUsd6, bool tokenIsC0) internal view returns (int24) {
        uint256 ethAmount = FullMath.mulDiv(mcapUsd6, 1e18, ethPriceRaw);
        uint256 ratioX192 = tokenIsC0
            ? FullMath.mulDiv(ethAmount, uint256(1) << 192, totalSupply)
            : FullMath.mulDiv(totalSupply, uint256(1) << 192, ethAmount);
        return TickMath.getTickAtSqrtPrice(uint160(Math.sqrt(ratioX192)));
    }

    /// @dev Mint single-sided TOKEN position spanning from just above/below current price to the extreme.
    ///      WARNING: Price movement will convert tokens — use _mintPosition for safe seeding.
    ///      tokenIsC0 = true:  TOKEN is currency0 → range ABOVE current tick to MAX
    ///      tokenIsC0 = false: TOKEN is currency1 → range from MIN to BELOW current tick
    function _mintSingleSidedPositionFromCurrentPrice(
        PoolKey memory poolKey,
        uint160 sqrtPriceX96,
        uint256 seedAmount,
        bool tokenIsC0
    ) internal {
        int24 initialTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;

        if (tokenIsC0) {
            tickLower = _roundUpToTickSpacing(initialTick + 1);
            tickUpper = TickMath.maxUsableTick(TICK_SPACING);
            liquidity = LiquidityAmounts.getLiquidityForAmount0(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), seedAmount
            );
        } else {
            tickLower = TickMath.minUsableTick(TICK_SPACING);
            tickUpper = _roundDownToTickSpacing(initialTick);
            liquidity = LiquidityAmounts.getLiquidityForAmount1(
                TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), seedAmount
            );
        }

        _encodeMintAndExecute(poolKey, tickLower, tickUpper, liquidity, seedAmount, tokenIsC0);
    }

    /// @dev Encode MINT_POSITION + CLOSE_CURRENCY actions and call PositionManager
    function _encodeMintAndExecute(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 seedAmount,
        bool tokenIsC0
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
            tokenIsC0 ? uint128(seedAmount) : uint128(0), // amount0Max
            tokenIsC0 ? uint128(0) : uint128(seedAmount), // amount1Max
            ActionConstants.MSG_SENDER,
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 60);
    }

    /// @dev Round tick UP to nearest multiple of TICK_SPACING
    function _roundUpToTickSpacing(int24 tick) internal pure returns (int24) {
        int24 mod = tick % TICK_SPACING;
        if (mod == 0) return tick;
        if (tick > 0) return tick + (TICK_SPACING - mod);
        return tick - mod; // negative: toward zero (up)
    }

    /// @dev Round tick DOWN to nearest multiple of TICK_SPACING
    function _roundDownToTickSpacing(int24 tick) internal pure returns (int24) {
        int24 mod = tick % TICK_SPACING;
        if (mod == 0) return tick;
        if (tick > 0) return tick - mod;
        return tick - (TICK_SPACING + mod); // negative: away from zero (down)
    }
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
    function allowance(address user, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

interface IWCHAN {
    function wrap(uint256 amount_) external;
}