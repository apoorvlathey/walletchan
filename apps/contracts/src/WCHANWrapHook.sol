// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {WCHAN} from '@src/WCHAN.sol';

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BalanceDelta} from '@uniswap/v4-core/src/types/BalanceDelta.sol';
import {BeforeSwapDelta, toBeforeSwapDelta} from '@uniswap/v4-core/src/types/BeforeSwapDelta.sol';
import {Currency} from '@uniswap/v4-core/src/types/Currency.sol';
import {Hooks, IHooks} from '@uniswap/v4-core/src/libraries/Hooks.sol';
import {IPoolManager} from '@uniswap/v4-core/src/interfaces/IPoolManager.sol';
import {PoolKey} from '@uniswap/v4-core/src/types/PoolKey.sol';


/**
 * Handles the 1:1 wrapping/unwrapping of WCHAN and the OLD_TOKEN
 */
contract WCHANWrapHook is IHooks {
    using SafeERC20 for IERC20;

    /// Thrown when trying to add liquidity directly to the pool
    error CannotAddLiquidity();

    /// We only accept swapping between WCHAN and OLD_TOKEN
    error InvalidTokenPair();

    /// This pool only has a fee of 0
    error FeeMustBeZero();

    /// Only the PoolManager can call this
    error NotPoolManager();

    /// Hook not implemented
    error HookNotImplemented();

    /// The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// The WCHAN token contract, that wraps/unwraps 1:1
    WCHAN public immutable wchan;
    address public immutable OLD_TOKEN;

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /**
     * Sets our immutable {PoolManager} contract reference.
     * Validates that the deployed address matches the declared hook permissions.
     *
     * @param _poolManager The Uniswap V4 {PoolManager} contract address
     * @param wchan_ Our token contract address
     */
    constructor(address _poolManager, WCHAN wchan_) {
        poolManager = IPoolManager(_poolManager);
        wchan = wchan_;
        OLD_TOKEN = wchan.OLD_TOKEN();

        // Validate that the deployed address encodes the correct hook permission flags
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());

        // Max-approve OLD_TOKEN to WCHAN for wrapping (avoids per-swap approve)
        IERC20(OLD_TOKEN).forceApprove(address(wchan_), type(uint256).max);
    }

    /**
     * This function defines the hooks that are required, and also importantly those which are
     * not, by our contract. This output determines the contract address that the deployment
     * must conform to and is validated by the PoolManager.
     */
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true, // enabled
            afterInitialize: false,
            beforeAddLiquidity: true, // enabled
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true, // enabled
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true, // enabled
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /**
     * Ensures that we only allow WCHAN/OLD_TOKEN pools to use the hook.
     *
     * @param key The `PoolKey` being initialized
     */
    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) external view onlyPoolManager returns (bytes4) {
        if (
            (Currency.unwrap(key.currency0) != OLD_TOKEN || Currency.unwrap(key.currency1) != address(wchan)) &&
            (Currency.unwrap(key.currency0) != address(wchan) || Currency.unwrap(key.currency1) != OLD_TOKEN)
        ) {
            revert InvalidTokenPair();
        }

        // Ensure that our fee is zero
        if (key.fee != 0) revert FeeMustBeZero();

        return IHooks.beforeInitialize.selector;
    }

    /**
     * This 'custom curve' is a line, 1-1. We take the full input amount, and give the full
     * output amount.
     *
     * @param key The `PoolKey` being swapped against
     * @param params The swap parameters passed by the caller
     */
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        (Currency inputCurrency, Currency outputCurrency, uint amount) = _getInputOutputAndAmount(key, params);

        // Take the amount from the {PoolManager}
        poolManager.take(inputCurrency, address(this), amount);

        // Convert inputCurrency to outputCurrency
        if (Currency.unwrap(inputCurrency) == OLD_TOKEN) {
            wchan.wrap(amount);
        } else {
            wchan.unwrap(amount);
        }

        // Settle the output currency
        poolManager.sync(outputCurrency);
        if (Currency.unwrap(outputCurrency) == OLD_TOKEN) {
            IERC20(OLD_TOKEN).safeTransfer(address(poolManager), amount);
            poolManager.settle();
        } else {
            wchan.transfer(address(poolManager), amount);
            poolManager.settle();
        }

        // Return -amountSpecified as specified to no-op the concentrated liquidity swap
        BeforeSwapDelta hookDelta = toBeforeSwapDelta(
            int128(-params.amountSpecified),
            int128(params.amountSpecified)
        );

        return (IHooks.beforeSwap.selector, hookDelta, 0);
    }

    /**
     * Prevent liquidity being added to the pool.
     */
    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4) {
        revert CannotAddLiquidity();
    }

    // ─── Unimplemented hooks ───

    function afterInitialize(address, PoolKey calldata, uint160, int24) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, BalanceDelta, bytes calldata)
        external virtual returns (bytes4, int128) {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    /**
     * Determines the input and output amounts, as well as token positions.
     *
     * @param key The `PoolKey` being swapped against
     * @param params The swap parameters passed by the caller
     *
     * @return input The token being swapped in
     * @return output The token being swapped out
     * @return amount The amount of input token being swapped in
     */
    function _getInputOutputAndAmount(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) internal pure returns (Currency input, Currency output, uint amount) {
        (input, output) = params.zeroForOne
            ? (key.currency0, key.currency1)
            : (key.currency1, key.currency0);

        amount = params.amountSpecified < 0
            ? uint(-params.amountSpecified)
            : uint(params.amountSpecified);
    }
}
