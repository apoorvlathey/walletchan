// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {LiquidityAmounts} from "@uniswap-periphery/libraries/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap-periphery/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap-periphery/libraries/Actions.sol";
import {ActionConstants} from "@uniswap-periphery/libraries/ActionConstants.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Initializes a Uni v4 pool for WETH/OLD_TOKEN at the same price as the
 * native-ETH/OLD_TOKEN pool on Base mainnet, then provides two-sided liquidity.
 *
 * Required env vars: DEV_PRIVATE_KEY, BASE_RPC_URL
 * Required in addresses.json:
 *   Chain 8453:    POOL_MANAGER, OLD_TOKEN_POOL_ID
 *   Current chain: POOL_MANAGER, POSITION_MANAGER, OLD_TOKEN, WETH
 *
 * Run:
 *   cd apps/contracts && source .env && forge script script/01_testnet_InitPoolAndAddLiquidity.s.sol:InitPoolAndAddLiquidity --broadcast -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract InitPoolAndAddLiquidity is DeployHelper {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    // --- Configurable max amounts for liquidity provision ---
    uint256 constant MAX_ETH_AMOUNT = 0.001 ether;
    uint256 constant MAX_OLD_TOKEN_AMOUNT = 1_000_000 ether; // 1M tokens

    int24 constant TICK_SPACING = 60;
    uint24 constant POOL_FEE = 10_000; // 1%

    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        _loadAddresses();

        address oldToken = _requireAddress("OLD_TOKEN");
        address weth = _requireAddress("WETH");
        bool wethIsToken0 = weth < oldToken;

        // Fetch and possibly invert mainnet price
        uint160 sqrtPriceX96;
        {
            uint160 mainnetSqrtPriceX96 = _fetchMainnetPrice();
            console.log("Mainnet sqrtPriceX96:", mainnetSqrtPriceX96);
            sqrtPriceX96 = wethIsToken0
                ? mainnetSqrtPriceX96
                : uint160((uint256(1) << 192) / uint256(mainnetSqrtPriceX96));
            console.log("Pool sqrtPriceX96:", sqrtPriceX96);
        }

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(wethIsToken0 ? weth : oldToken),
            currency1: Currency.wrap(wethIsToken0 ? oldToken : weth),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        (uint128 liquidity, uint256 amount0, uint256 amount1) = _computeAmounts(sqrtPriceX96, wethIsToken0);
        console.log("Liquidity:", liquidity);
        console.log("Amount0:", amount0);
        console.log("Amount1:", amount1);

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        IPoolManager(_requireAddress("POOL_MANAGER")).initialize(poolKey, sqrtPriceX96);
        console.log("Pool initialized");

        // Wrap ETH -> WETH
        IWETH(weth).deposit{value: wethIsToken0 ? amount0 : amount1}();

        // Approve both tokens via Permit2
        address posm = _requireAddress("POSITION_MANAGER");
        _approveViaPermit2(weth, posm);
        _approveViaPermit2(oldToken, posm);

        // Mint position
        _mintPosition(IPositionManager(posm), poolKey, liquidity, amount0, amount1);
        console.log("Liquidity provided");

        vm.stopBroadcast();

        _saveBytes32("OLD_TOKEN_POOL_ID", PoolId.unwrap(poolKey.toId()));
    }

    /// @dev Reads sqrtPriceX96 from the OLD_TOKEN pool on Base mainnet via fork
    function _fetchMainnetPrice() internal returns (uint160 sqrtPriceX96) {
        uint256 currentFork = vm.activeFork();
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        IPoolManager basePoolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        PoolId poolId = PoolId.wrap(_requireBytes32("OLD_TOKEN_POOL_ID"));
        (sqrtPriceX96,,,) = basePoolManager.getSlot0(poolId);

        vm.selectFork(currentFork);
    }

    /// @dev Compute liquidity and exact amounts for full-range position
    function _computeAmounts(uint160 sqrtPriceX96, bool wethIsToken0)
        internal
        pure
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        uint256 maxAmount0 = wethIsToken0 ? MAX_ETH_AMOUNT : MAX_OLD_TOKEN_AMOUNT;
        uint256 maxAmount1 = wethIsToken0 ? MAX_OLD_TOKEN_AMOUNT : MAX_ETH_AMOUNT;

        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, maxAmount0, maxAmount1
        );
        (amount0, amount1) = _getAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, liquidity);
    }

    /// @dev Approve token -> Permit2 -> spender
    function _approveViaPermit2(address token, address spender) internal {
        IERC20(token).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(token, spender, type(uint160).max, uint48(block.timestamp + 1 hours));
    }

    /// @dev Encode and execute MINT_POSITION + SETTLE_PAIR + SWEEP both tokens
    function _mintPosition(
        IPositionManager positionManager,
        PoolKey memory poolKey,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ) internal {
        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);

        bytes memory actions = new bytes(4);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.SETTLE_PAIR));
        actions[2] = bytes1(uint8(Actions.SWEEP));
        actions[3] = bytes1(uint8(Actions.SWEEP));

        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(
            poolKey, tickLower, tickUpper,
            uint256(liquidity), uint128(amount0), uint128(amount1),
            ActionConstants.MSG_SENDER, bytes("")
        );
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        params[2] = abi.encode(poolKey.currency0, ActionConstants.MSG_SENDER);
        params[3] = abi.encode(poolKey.currency1, ActionConstants.MSG_SENDER);

        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 60);
    }

    /// @dev Compute exact token amounts for a given liquidity and price range
    function _getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);

        if (sqrtPriceX96 <= sqrtPriceAX96) {
            amount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity, true);
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            amount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceX96, sqrtPriceBX96, liquidity, true);
            amount1 = SqrtPriceMath.getAmount1Delta(sqrtPriceAX96, sqrtPriceX96, liquidity, true);
        } else {
            amount1 = SqrtPriceMath.getAmount1Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity, true);
        }
    }
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IWETH {
    function deposit() external payable;
}