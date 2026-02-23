// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Hooks, IHooks} from '@uniswap/v4-core/src/libraries/Hooks.sol';
import {IPoolManager} from '@uniswap/v4-core/src/interfaces/IPoolManager.sol';
import {PoolKey} from '@uniswap/v4-core/src/types/PoolKey.sol';
import {Currency} from '@uniswap/v4-core/src/types/Currency.sol';
import {PoolId, PoolIdLibrary} from '@uniswap/v4-core/src/types/PoolId.sol';
import {BeforeSwapDelta, toBeforeSwapDelta, BeforeSwapDeltaLibrary} from '@uniswap/v4-core/src/types/BeforeSwapDelta.sol';
import {StateLibrary} from '@uniswap/v4-core/src/libraries/StateLibrary.sol';
import {SwapMath} from '@uniswap/v4-core/src/libraries/SwapMath.sol';
import {TickMath} from '@uniswap/v4-core/src/libraries/TickMath.sol';
import {SafeCast} from '@uniswap/v4-core/src/libraries/SafeCast.sol';
import {BalanceDelta} from '@uniswap/v4-core/src/types/BalanceDelta.sol';

import {CurrencySettler} from "./utils/CurrencySettler.sol";
import {UniswapHookEvents} from "./utils/UniswapHookEvents.sol";

/**
 * Uniswap V4 hook that charges & distributes the swap fees to the dev
 */
contract WCHANDevFeeHook is Ownable, IHooks {

    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using SafeCast for uint;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;
    using CurrencySettler for Currency;

    struct PendingFees {
        uint256 wethAmount;
        uint256 wchanAmount;
    }

    /// The address that'll be able to claim the swap fees accumulated in WETH
    address public dev;
    uint24 public constant DEV_FEE_IN_BPS = 1_00; // 1%
    uint256 internal constant ONE_HUNDRED_PERCENT_IN_BPS = 100_00; // 100%

    /// The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// if pool is already initialized
    bool internal isInitialized;

    /// The 2 coins for our pool
    address public immutable wchan;
    address public immutable weth;
    bool public immutable isWethCurrencyZero;

    /// Our pool details
    PoolKey public poolKey;
    PoolId public immutable poolId;

    /// Pending Fees in the contract to be used in ISP or claimable wethAmount
    PendingFees public pendingFees;

    // hardcoding these keys as assembly block doesn't accept directly keccak values here, for tstore
    bytes32 internal constant TS_ISP_AMOUNT0 = 0x6f3aaf2d9b8abdcaf9b914c61f65f3cb2b9d9299b5dc71717a7e7e5dc2f795e3; // keccak256("TS_ISP_AMOUNT0")
    bytes32 internal constant TS_ISP_AMOUNT1 = 0x8facdcbfca6c1366fde5f648694c349dd4dec100c8ff2bfa9186bfd712dc243b; // keccak256("TS_ISP_AMOUNT1")
    bytes32 internal constant TS_ISP_FEE0 = 0x1a426dc34b0367779dd37e66c4b193647bd2fd094d26b263dccbe93433d0a25b;   // keccak256("TS_ISP_FEE0")
    bytes32 internal constant TS_ISP_FEE1 = 0xb5692db6de7b607ce10bbcb6a38fb443823969b63ffea1591751f25f9fe7059a;   // keccak256("TS_ISP_FEE1")
    bytes32 internal constant TS_UNI_FEE0 = 0x84457b11f2602289c00904214483ea820055ea325cc54ad9b512e76c6541dfb4;   // keccak256("TS_UNI_FEE0")
    bytes32 internal constant TS_UNI_FEE1 = 0x6bc3f16992c8e44a3018b72b6d7aec54e64e1cdec74e64c5154c782ffe8aff2d;   // keccak256("TS_UNI_FEE1")

    /**
     * =======
     * Events
     * =======
     */

    event DevAddressUpdated(address dev);
    event InternalSwap(bool zeroForOne, uint256 wethIn, uint256 wchanOut);
    event SwapFeesReceived(uint256 wethAmount, uint256 wchanAmount);
    event WethClaimed(address indexed dev, uint256 amount);
    event PoolSwap(int ispAmount0, int ispAmount1, int ispFee0, int ispFee1, int uniAmount0, int uniAmount1, int uniFee0, int uniFee1);


    /**
     * =======
     * Errors
     * =======
     */
    error NotPoolManager();
    error AlreadyInitialized();
    error CannotInitializePoolDirectly();
    error InvalidPoolKey();
    error HookNotImplemented();

    constructor (
        address dev_,
        address initialOwner_,
        address poolManager_,
        address wchan_,
        address weth_
    ) Ownable(initialOwner_) {
        dev = dev_;
        poolManager = IPoolManager(poolManager_);
        wchan = wchan_;
        weth = weth_;

        isWethCurrencyZero = weth < wchan;
        poolKey = PoolKey({
            currency0: Currency.wrap(isWethCurrencyZero ? weth : wchan),
            currency1: Currency.wrap(isWethCurrencyZero ? wchan : weth),
            fee: 0,
            tickSpacing: 60,
            // using this contract as the hook
            hooks: IHooks(address(this))
        });

        poolId = poolKey.toId();

        // Validate that the deployed address encodes the correct hook permission flags
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /**
     * Initialize our Uniswap V4 Pool with a starting sqrtPrice. Can only be called by the owner, so we set the current price.
     */
    function initialize(uint160 _initialSqrtPriceX96) external onlyOwner {
        // revert if already initialized
        if (isInitialized) revert AlreadyInitialized();

        // initialize our pool with the provided initial sqrtPriceX96
        // can only be called by this contract due to check in our beforeInitialize hook
        poolManager.initialize({
            key: poolKey,
            sqrtPriceX96: _initialSqrtPriceX96
        });

        isInitialized = true;
    }

    /**
     * This function defines the hooks that are required, and also importantly those which are
     * not, by our contract. This output determines the contract address that the deployment
     * must conform to and is validated by the PoolManager.
     */
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true, // Prevent external initialize
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true, // Internal Swap Pool
            afterSwap: true, // Uniswap Swap Fees, Events
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true, // Internal Swap Pool
            afterSwapReturnDelta: true, // Uniswap Swap Fees
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /**
     * The hook called before the state of a pool is initialized. Prevents external contracts
     * from initializing pools using our contract as a hook.
     *
     * @dev As we call `poolManager.initialize` from the IHooks contract itself, we bypass this
     * hook call therefore bypassing the prevention.
     */
    function beforeInitialize(address, PoolKey calldata, uint160) external view override onlyPoolManager returns (bytes4) {
        revert CannotInitializePoolDirectly();
    }

    /**
     * Checks if we can process an internal swap ahead of the Uniswap swap.
     * using the fees accumulated in the internal swap pool
     *
     * @param _key The key for the pool
     * @param _params The parameters for the swap
     *
     * @return selector_ The function selector for the hook
     * @return beforeSwapDelta_ The hook's delta in specified and unspecified currencies. Positive: the hook is owed/took currency, negative: the hook owes/sent currency
     * @return swapFee_ The percentage fee applied to our swap
     */
    function beforeSwap(
        address /** _sender */,
        PoolKey calldata _key,
        IPoolManager.SwapParams memory _params,
        bytes calldata /** _hookData */
    ) public override onlyPoolManager returns (
        bytes4 selector_,
        BeforeSwapDelta beforeSwapDelta_,
        uint24
    ) {
        // reject swaps for any other poolKeys than wchan/weth
        _verifyPoolKey(_key);

        /**
         * If we have pending WCHAN tokens from fees, we can use them to fill the swap before it hits the Uniswap pool.
         * This prevents the pool from being affected and reduced gas costs while benefitting from Uniswap's routing infra.
         * It also removes price impact against the Uniswap pool.
         */

        (uint256 _wethIn, uint256 _wchanOut) = _internalSwap(_params);

        // non-zero means user is swapping WETH for WCHAN
        if (_wethIn + _wchanOut > 0) {
            /**
             * We need to update our hook delta to reduce the upcoming swap amount via the Uniswap pool, as we already fulfilled some WCHAN to WETH swap
            */

            // first determine the swap delta for our ISP swap
            BeforeSwapDelta internalBeforeSwapDelta;
            if (_params.amountSpecified >= 0) {
                // => output amount specified = WCHAN
                internalBeforeSwapDelta = toBeforeSwapDelta({
                    deltaSpecified: -_wchanOut.toInt128(), // -ve because HOOK sent out these tokens
                    deltaUnspecified: _wethIn.toInt128()   // +ve because HOOK received these tokens 
                });
            } else {
                // => input amount specified = WETH
                internalBeforeSwapDelta = toBeforeSwapDelta({
                    deltaSpecified: _wethIn.toInt128(),     // +ve because HOOK received these tokens 
                    deltaUnspecified: -_wchanOut.toInt128() // -ve because HOOK sent out these tokens
                });
            }

            /**
             * Determine the amount of fees generated by our internal swap to capture, rather than sending the full amount to the user.
            */
            uint256 swapFee = _takeFeesFromUnspecifiedAmount(_params, internalBeforeSwapDelta.getUnspecifiedDelta());

            // Capture the deltas for afterSwap event tracking
            _captureDelta(_params, TS_ISP_AMOUNT0, TS_ISP_AMOUNT1, internalBeforeSwapDelta);
            _captureDeltaSwapFee(_params, TS_ISP_FEE0, TS_ISP_FEE1, swapFee);

            // Increase the delta being sent back, including swapFee as well
            beforeSwapDelta_ = toBeforeSwapDelta(
                beforeSwapDelta_.getSpecifiedDelta() + internalBeforeSwapDelta.getSpecifiedDelta(),
                beforeSwapDelta_.getUnspecifiedDelta() + internalBeforeSwapDelta.getUnspecifiedDelta() + swapFee.toInt128()
            );
        }

        return (IHooks.beforeSwap.selector, beforeSwapDelta_, 0);
    }

    /**
     * Take fees from the Uniswap swap amount, log events
     */
    function afterSwap(
        address _sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata _params,
        BalanceDelta _delta,
        bytes calldata
    ) public override onlyPoolManager returns (
        bytes4 selector_,
        int128 hookDeltaUnspecified_
    ) {
        /**
         * Determine the amount of fees generated by the Uniswap swap to capture, rather than sending the full amount to the user.
         */

        // We'll take the fees from the unspecified amount
        (int128 uniAmount0, int128 uniAmount1) = (_delta.amount0(), _delta.amount1());
        int128 swapAmount = _determineUnspecifiedAmountAfterSwap(
            _params.zeroForOne,
            _params.amountSpecified,
            uniAmount0,
            uniAmount1
        );

        // take swapFees on the swap via Uniswap Pool
        uint swapFee = _takeFeesFromUnspecifiedAmount(_params, swapAmount);

        // capturing first as it formats the values, making it ready for the event below
        _captureDeltaSwapFee(_params, TS_UNI_FEE0, TS_UNI_FEE1, swapFee);
        
        // Emit our custom event
        emit PoolSwap(
            _tload(TS_ISP_AMOUNT0), _tload(TS_ISP_AMOUNT1), _tload(TS_ISP_FEE0), _tload(TS_ISP_FEE1),
            uniAmount0, uniAmount1, _tload(TS_UNI_FEE0), _tload(TS_UNI_FEE1)
        );

        // Emit the Uniswap V4 standardised event
        UniswapHookEvents.emitHookSwapEvent({
            _poolId: poolId,
            _sender: _sender,
            _amount0: _tload(TS_ISP_AMOUNT0),
            _amount1: _tload(TS_ISP_AMOUNT1),
            _fee0: _tload(TS_ISP_FEE0),
            _fee1: _tload(TS_ISP_FEE1)
        });

        // @dev We flush the tstore values at this point, although they are only set explicitly and not modified, 
        // the ISP could be bypassed making the tstore data to remain.
        assembly {
            tstore(TS_ISP_AMOUNT0, 0)
            tstore(TS_ISP_AMOUNT1, 0)
            tstore(TS_ISP_FEE0, 0)
            tstore(TS_ISP_FEE1, 0)
            tstore(TS_UNI_FEE0, 0)
            tstore(TS_UNI_FEE1, 0)
        }

        // Set our return selector
        hookDeltaUnspecified_ = swapFee.toInt128();
        selector_ = IHooks.afterSwap.selector;
    }

    /**
     * Claim collected weth fees, callable by anyone but weth always sent to `dev`
     */
    function claimFees() external {
        uint256 claimableWethAmount = pendingFees.wethAmount;

        if (claimableWethAmount > 0) {
            pendingFees.wethAmount = 0;

            IERC20(weth).transfer(dev, claimableWethAmount);

            emit WethClaimed(dev, claimableWethAmount);
        }
    }

    /**
     * ================
     * Owner Functions
     * ================
     */

    function updateDevAddress(address _dev) external onlyOwner {
        dev = _dev;
        emit DevAddressUpdated(_dev);
    }

    /**
     * ==========================
     * Internal Helper Functions
     * ==========================
     */

    /**
     * Verify and revert if the tokens don't match wchan/weth pair
     */
    function _verifyPoolKey(PoolKey memory _key) internal view {
        if (
            Currency.unwrap(_key.currency0) != Currency.unwrap(poolKey.currency0) || 
            Currency.unwrap(_key.currency1) != Currency.unwrap(poolKey.currency1)
        ) revert InvalidPoolKey();
    }

    /**
     * If user is buying WCHAN, then fulfill portion of it (or full amount) from our pendingFees
     */
    function _internalSwap(
        IPoolManager.SwapParams memory _params
    ) internal returns (
        uint256 wethIn_,
        uint256 wchanOut_
    ) {
        // Cache the current pending fees in memory
        PendingFees memory _pendingFees = pendingFees;

        // if we have no pending wchan amount, then there's nothing to swap so return early
        if (_pendingFees.wchanAmount == 0) return (0, 0);

        // We only want to process our internal swap if user is buying WCHAN with WETH (WETH for WCHAN).
        if (isWethCurrencyZero) {
            if (_params.zeroForOne) {
                // zero for one = weth for wchan, continue with ISP
            } else {
                // return early
                return (0, 0);
            }
        } else {
            if (_params.zeroForOne) {
                // zero for one = wchan for weth, return early
                return (0, 0);
            } else {
                // one for zero = weth for wchan, continue with ISP
            }
        }

        // Get the current price for our pool
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        // Since we have a positive amountSpecified (exact WCHAN output), we can determine the maximum amount that we can fulfill from our pool fees.
        if (_params.amountSpecified >= 0) {
            uint256 amountSpecified = uint256(_params.amountSpecified);
            // the hook can only fulfill upto our pending WCHAN balance, the rest would be handled by Uniswap pool's liquidity
            if (amountSpecified > _pendingFees.wchanAmount) amountSpecified = _pendingFees.wchanAmount;

            // Capture the amount of WETH required at the current pool state to purchase the amount of WCHAN specified
            (, wethIn_, wchanOut_, ) = SwapMath.computeSwapStep({
                sqrtPriceCurrentX96: sqrtPriceX96,
                sqrtPriceTargetX96: _params.sqrtPriceLimitX96,
                liquidity: poolManager.getLiquidity(poolId),
                // +ve amountRemaining = exact out swap (from SwapMath)
                amountRemaining: int(amountSpecified), // already positive
                feePips: 0
            });
        }
        // As we have a negative amountSpecified (exact WETH input), this means that we are spending fixed amount of WETH to get any amount of WCHAN.
        else {
            // We need to calculate how much WCHAN is needed by the Hook to get that WETH from user, meaning a swap in the opposite direction (WCHAN for WETH, exact out) that'll give us the WCHAN amount
            // Suppose isWETHCurrencyZero = true => zeroForOne = true (WETH for WCHAN), we'll simulate oneForZero (WCHAN for WETH) as exact output
            // price = amount of currency1 / currency0 in the pool. so a oneForZero swap increases c1 and reduces c0 in the pool, making the price go up.
            // => we need a higher price target (MAX_SQRT_PRICE - 1) here
            // similarly in the opposite case when isWETHCurrencyZero = false, we're doing zeroForOne swap calculation bringing price down so target is MIN_SQRT_PRICE + 1
            (, wchanOut_, wethIn_, ) = SwapMath.computeSwapStep({
                sqrtPriceCurrentX96: sqrtPriceX96,
                sqrtPriceTargetX96: _params.zeroForOne ? TickMath.MAX_SQRT_PRICE - 1 : TickMath.MIN_SQRT_PRICE + 1,
                liquidity: poolManager.getLiquidity(poolId),
                amountRemaining: int(-_params.amountSpecified), // making amountRemaining +ve for exact WETH out calculation (amountSpecified is -ve here)
                feePips: 0
            });

            // If we cannot fulfill the full amount from the internal orderbook, then we want to calculate the percentage of WETH which we can fulfill.
            if (wchanOut_ > _pendingFees.wchanAmount) {
                wethIn_ = (_pendingFees.wchanAmount * wethIn_) / wchanOut_;
                wchanOut_ = _pendingFees.wchanAmount;
            }
        }

        // If nothing has happened, we can exit
        if (wethIn_ == 0 && wchanOut_ == 0) return (0, 0);

        // Reduce the amount of WCHAN fees that have been used up from the pool and converted into WETH fees.
        pendingFees.wethAmount = _pendingFees.wethAmount + wethIn_;
        pendingFees.wchanAmount = _pendingFees.wchanAmount - wchanOut_;

        // Take and Settle the balance changes as per our swap here
        poolManager.take(Currency.wrap(weth), address(this), wethIn_);
        Currency.wrap(wchan).settle(poolManager, address(this), wchanOut_, false);

        // Capture the swap cost that we captured from our drip
        emit InternalSwap(_params.zeroForOne, wethIn_, wchanOut_);
    }

    function _takeFeesFromUnspecifiedAmount(
        IPoolManager.SwapParams memory _params,
        int128 _delta
    ) internal returns (uint256 swapFee_) {
        // return early if there's no delta
        if (_delta == 0) return swapFee_;

        // we charge fees in the unspecified amount currency (could be input or output, depending on swap direction)
        Currency swapFeeCurrency = _determineCurrencyWithUnspecifiedAmount(_params.zeroForOne, _params.amountSpecified);

        uint256 _swapAmount = _absValue(_delta);
        // Calculate our fee amount
        swapFee_ = _swapAmount * DEV_FEE_IN_BPS / ONE_HUNDRED_PERCENT_IN_BPS;
        // Take our swap fees from the {PoolManager}
        poolManager.take(swapFeeCurrency, address(this), swapFee_);

        // update our claimable fee amount
        if (Currency.unwrap(swapFeeCurrency) == weth) {
            pendingFees.wethAmount += swapFee_;
            emit SwapFeesReceived(swapFee_, 0);
        } else {
            pendingFees.wchanAmount += swapFee_;
            emit SwapFeesReceived(0, swapFee_);
        }
    }

    function _determineCurrencyWithUnspecifiedAmount(bool _zeroForOne, int256 _amountSpecified) internal view returns (Currency unspecifiedAmountCurrency_) {
        // NOTE: a positive amountSpecified (>=0) means that the user has specified the output token amount they want to receive
        // as they'll gain that balance, after the swap

        if (_zeroForOne) {
            // swapping from currency0 to currency1

            if (_amountSpecified >= 0) {
                // exact amount is in output currency, input unspecified
                unspecifiedAmountCurrency_ = poolKey.currency0;
            } else {
                // exact amount is in input currency, output unspecified
                unspecifiedAmountCurrency_ = poolKey.currency1;
            }
        } else {
            // swapping from currency1 to currency0

            if (_amountSpecified >= 0) {
                // exact amount is in output currency, input unspecified
                unspecifiedAmountCurrency_ = poolKey.currency1;
            } else {
                // exact amount is in input currency, output unspecified
                unspecifiedAmountCurrency_ = poolKey.currency0;
            }
        }
    }

    function _determineUnspecifiedAmountAfterSwap(
        bool _zeroForOne,
        int256 _amountSpecified,
        int128 _amount0,
        int128 _amount1
    ) internal pure returns (int128 unspecifiedSwapAmount_) {
        if (_zeroForOne) {
            // zero for one
            if (_amountSpecified >= 0 ) {
                // output specified, so taking fees in input (unspecified)
                unspecifiedSwapAmount_ = _amount0;
            } else {
                // input specified, so taking fees in output (unspecified)
                unspecifiedSwapAmount_ = _amount1;
            }
        } else {
            // one for zero
            if (_amountSpecified >= 0 ) {
                // output specified, so taking fees in input (unspecified)
                unspecifiedSwapAmount_ = _amount1;
            } else {
                // input specified, so taking fees in output (unspecified)
                unspecifiedSwapAmount_ = _amount0;
            }
        }
    }

    function _absValue(int128 _val) internal pure returns (uint256 abs_) {
        abs_ = uint128(_val < 0 ? -_val : _val); 
    }

    /**
     * We need to be able to set the (un)specified token to amount0 / amount1 for the expected
     * event emit format.
     *
     * @param _params The `SwapParams` used to capture the delta
     * @param _key_amount0 The tstore key for the token0 amount
     * @param _key_amount1 The tstore key for the token1 amount
     * @param _delta The `BeforeSwapDelta` that is being captured
     */
    function _captureDelta(
        IPoolManager.SwapParams memory _params,
        bytes32 _key_amount0,
        bytes32 _key_amount1,
        BeforeSwapDelta _delta
    ) internal {
        (int token0, int token1) = _params.amountSpecified < 0 == _params.zeroForOne
            ? (-_delta.getSpecifiedDelta(), -_delta.getUnspecifiedDelta())
            : (-_delta.getUnspecifiedDelta(), -_delta.getSpecifiedDelta());

        // Store our amounts
        assembly {
            tstore(_key_amount0, token0)
            tstore(_key_amount1, token1)
        }
    }

    /**
     * Maps our swap fee to the expected event emit format.
     *
     * @param _params The `SwapParams` used to capture the delta
     * @param _key_fee0 The tstore key for the token0 fee amount
     * @param _key_fee1 The tstore key for the token1 fee amount
     * @param _delta The `uint` that is being captured for the fee
     */
    function _captureDeltaSwapFee(
        IPoolManager.SwapParams memory _params,
        bytes32 _key_fee0,
        bytes32 _key_fee1,
        uint _delta
    ) internal {
        // The delta provided needs to be made negative
        int delta = -int(_delta);

        if (_params.amountSpecified < 0 == _params.zeroForOne) {
            assembly {
                tstore(_key_fee0, 0)
                tstore(_key_fee1, delta)
            }
        } else {
            assembly {
                tstore(_key_fee0, delta)
                tstore(_key_fee1, 0)
            }
        }
    }

    /**
     * Helper function to allow for tstore-d variables to be called individually. This saves us
     * defining an additional variable before our `tload` calls inside the function.
     *
     * @param _key The `tstore` key to load
     *
     * @return value_ The `int` value in the tstore
     */
    function _tload(bytes32 _key) internal view returns (int value_) {
        assembly { value_ := tload(_key) }
    }

    /**
     * ===================
     * Unimplemented hooks
     * ===================
     */

    function afterInitialize(address, PoolKey calldata, uint160, int24) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external view virtual returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual returns (
        bytes4,
        BalanceDelta
    ) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external virtual returns (bytes4) 
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) public virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external virtual returns (bytes4) 
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint, uint, bytes calldata) 
        external virtual returns (bytes4)
    {
        revert HookNotImplemented();
    }
}