// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Actions} from "@uniswap-periphery/libraries/Actions.sol";
import {DeployHelper} from "../DeployHelper.s.sol";

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce);
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

/// @dev Matches the on-chain UniversalRouter's V4Router ExactInputParams (no maxHopSlippage)
struct PathKey {
    Currency intermediateCurrency;
    uint24 fee;
    int24 tickSpacing;
    IHooks hooks;
    bytes hookData;
}

struct ExactInputParams {
    Currency currencyIn;
    PathKey[] path;
    uint128 amountIn;
    uint128 amountOutMinimum;
}

/**
 * Base contract for swapping via the WCHANWrapHook pool (1:1, fee=0) through the UniversalRouter.
 * Subclasses just specify the direction (tokenIn / tokenOut).
 *
 * Required in addresses.json: OLD_TOKEN, WCHAN, WCHAN_WRAP_HOOK, UNIVERSAL_ROUTER
 */
abstract contract SwapViaWrapHook is DeployHelper {
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint256 constant SWAP_AMOUNT = 1000e18;
    int24 constant TICK_SPACING = 60;

    /// @dev UniversalRouter command for V4_SWAP
    bytes1 constant V4_SWAP = 0x10;

    /// @dev Override to specify swap direction
    function _getTokens(address oldToken, address wchan)
        internal
        pure
        virtual
        returns (address tokenIn, address tokenOut);

    function run() external {
        _loadAddresses();

        address oldToken = _requireAddress("OLD_TOKEN");
        address wchan = _requireAddress("WCHAN");
        address wchanWrapHook = _requireAddress("WCHAN_WRAP_HOOK");
        address universalRouter = _requireAddress("UNIVERSAL_ROUTER");

        (address tokenIn, address tokenOut) = _getTokens(oldToken, wchan);

        uint256 devPk = vm.envUint("DEV_PRIVATE_KEY");
        address dev = vm.addr(devPk);

        uint256 balance = IERC20(tokenIn).balanceOf(dev);
        require(balance >= SWAP_AMOUNT, "Insufficient tokenIn balance");

        console.log("Swap via WCHANWrapHook");
        console.log("  Amount:", SWAP_AMOUNT);
        console.log("  tokenIn:", tokenIn);
        console.log("  tokenOut:", tokenOut);
        console.log("  Hook:", wchanWrapHook);
        console.log("  Router:", universalRouter);

        vm.startBroadcast(devPk);

        // 1. Approve tokenIn → Permit2
        if (IERC20(tokenIn).allowance(dev, PERMIT2) < SWAP_AMOUNT) {
            IERC20(tokenIn).approve(PERMIT2, type(uint256).max);
            console.log("  Approved tokenIn -> Permit2");
        }

        // 2. Approve Permit2 → UniversalRouter
        (uint160 permit2Allowance,,) = IPermit2(PERMIT2).allowance(dev, tokenIn, universalRouter);
        if (permit2Allowance < SWAP_AMOUNT) {
            IPermit2(PERMIT2).approve(tokenIn, universalRouter, type(uint160).max, uint48(block.timestamp + 1 hours));
            console.log("  Approved Permit2 -> UniversalRouter");
        }

        // 3. Build V4 swap calldata and execute
        bytes memory v4RouterData = _buildV4SwapData(tokenIn, tokenOut, wchanWrapHook);

        bytes memory commands = abi.encodePacked(V4_SWAP);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = v4RouterData;

        IUniversalRouter(universalRouter).execute(commands, inputs, block.timestamp + 60);

        vm.stopBroadcast();

        uint256 outBalance = IERC20(tokenOut).balanceOf(dev);
        console.log("  Swap complete! tokenOut balance:", outBalance);
    }

    function _buildV4SwapData(address tokenIn, address tokenOut, address wchanWrapHook)
        internal
        pure
        returns (bytes memory)
    {
        // V4 actions: SWAP_EXACT_IN + SETTLE_ALL + TAKE_ALL
        bytes memory actions = abi.encodePacked(
            bytes1(uint8(Actions.SWAP_EXACT_IN)),
            bytes1(uint8(Actions.SETTLE_ALL)),
            bytes1(uint8(Actions.TAKE_ALL))
        );

        // Single-hop path via WCHANWrapHook (1:1)
        PathKey[] memory path = new PathKey[](1);
        path[0] = PathKey({
            intermediateCurrency: Currency.wrap(tokenOut),
            fee: 0,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(wchanWrapHook),
            hookData: ""
        });

        bytes memory swapParams = abi.encode(
            ExactInputParams({
                currencyIn: Currency.wrap(tokenIn),
                path: path,
                amountIn: uint128(SWAP_AMOUNT),
                amountOutMinimum: uint128(SWAP_AMOUNT) // 1:1 swap
            })
        );

        bytes memory settleParams = abi.encode(Currency.wrap(tokenIn), SWAP_AMOUNT);
        bytes memory takeParams = abi.encode(Currency.wrap(tokenOut), SWAP_AMOUNT);

        bytes[] memory v4Params = new bytes[](3);
        v4Params[0] = swapParams;
        v4Params[1] = settleParams;
        v4Params[2] = takeParams;

        return abi.encode(actions, v4Params);
    }
}
