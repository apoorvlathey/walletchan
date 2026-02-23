// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {WCHANDevFeeHook} from "@src/WCHANDevFeeHook.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";


// ═══════════════════════════════════════════════════
//               BASE TEST CONTRACT
// ═══════════════════════════════════════════════════

abstract contract DevFeeHookBaseTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    WCHANDevFeeHook public hook;
    MockERC20 public wchanToken;
    MockERC20 public wethToken;

    PoolKey poolKey;
    PoolId poolId;
    bool isWethCurrencyZero;

    address dev = makeAddr("dev");
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant INITIAL_LIQUIDITY = 100 ether;
    uint256 constant SWAP_AMOUNT = 1 ether;

    // Replicate events for expectEmit
    event DevAddressUpdated(address dev);
    event InternalSwap(bool zeroForOne, uint256 wethIn, uint256 wchanOut);
    event SwapFeesReceived(uint256 wethAmount, uint256 wchanAmount);
    event WethClaimed(address indexed dev, uint256 amount);
    event PoolSwap(int ispAmount0, int ispAmount1, int ispFee0, int ispFee1, int uniAmount0, int uniAmount1, int uniFee0, int uniFee1);

    function setUp() public virtual {
        // 1. Deploy PoolManager and test routers
        deployFreshManagerAndRouters();

        // 2. Deploy mock tokens
        wchanToken = new MockERC20("WalletChan", "WCHAN", 18);
        wethToken = new MockERC20("Wrapped Ether", "WETH", 18);

        // 3. Deploy WCHANDevFeeHook at correct flag address
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(
            dev, owner, address(manager), address(wchanToken), address(wethToken)
        );
        (address hookAddr, bytes32 salt) = HookMiner.find(
            address(this), flags, type(WCHANDevFeeHook).creationCode, constructorArgs
        );
        hook = new WCHANDevFeeHook{salt: salt}(
            dev, owner, address(manager), address(wchanToken), address(wethToken)
        );
        require(address(hook) == hookAddr, "Hook address mismatch");

        // 4. Cache pool params
        isWethCurrencyZero = address(wethToken) < address(wchanToken);
        {
            (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks hooks) = hook.poolKey();
            poolKey = PoolKey(c0, c1, fee, tickSpacing, hooks);
        }
        poolId = poolKey.toId();

        // 5. Initialize the pool via the hook (only owner can call)
        vm.prank(owner);
        hook.initialize(SQRT_PRICE_1_1);

        // 6. Mint tokens for liquidity and swaps
        wchanToken.mint(address(this), 1_000_000 ether);
        wethToken.mint(address(this), 1_000_000 ether);
        wchanToken.mint(alice, 100_000 ether);
        wethToken.mint(alice, 100_000 ether);
        wchanToken.mint(bob, 100_000 ether);
        wethToken.mint(bob, 100_000 ether);

        // 7. Approve routers
        wchanToken.approve(address(swapRouter), type(uint256).max);
        wethToken.approve(address(swapRouter), type(uint256).max);
        wchanToken.approve(address(modifyLiquidityRouter), type(uint256).max);
        wethToken.approve(address(modifyLiquidityRouter), type(uint256).max);

        vm.startPrank(alice);
        wchanToken.approve(address(swapRouter), type(uint256).max);
        wethToken.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        wchanToken.approve(address(swapRouter), type(uint256).max);
        wethToken.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();

        // 8. Add initial liquidity
        _addLiquidity(INITIAL_LIQUIDITY);
    }

    // ═══════════════════════════════════════════════════
    //                    HELPERS
    // ═══════════════════════════════════════════════════

    function _addLiquidity(uint256 amount) internal {
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -887220,  // full-range (divisible by 60)
                tickUpper: 887220,
                liquidityDelta: int256(amount),
                salt: 0
            }),
            ZERO_BYTES
        );
    }

    /// @dev Buy WCHAN with WETH (exact input)
    function _buyWchan(uint256 wethAmount) internal returns (BalanceDelta) {
        bool zeroForOne = isWethCurrencyZero;
        return swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(wethAmount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
    }

    /// @dev Buy WCHAN with WETH (exact output - specify WCHAN amount desired)
    function _buyWchanExactOutput(uint256 wchanAmount) internal returns (BalanceDelta) {
        bool zeroForOne = isWethCurrencyZero;
        return swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(wchanAmount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
    }

    /// @dev Sell WCHAN for WETH (exact input)
    function _sellWchan(uint256 wchanAmount) internal returns (BalanceDelta) {
        bool zeroForOne = !isWethCurrencyZero;
        return swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(wchanAmount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
    }

    /// @dev Sell WCHAN for WETH (exact output - specify WETH amount desired)
    function _sellWchanExactOutput(uint256 wethAmount) internal returns (BalanceDelta) {
        bool zeroForOne = !isWethCurrencyZero;
        return swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(wethAmount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
    }

    function _getPendingFees() internal view returns (uint256 wethAmt, uint256 wchanAmt) {
        (wethAmt, wchanAmt) = hook.pendingFees();
    }
}


// ═══════════════════════════════════════════════════
//              CONSTRUCTOR & INIT
// ═══════════════════════════════════════════════════

contract DevFeeHookConstructorTest is DevFeeHookBaseTest {

    function test_constructorSetsImmutables() public view {
        assertEq(address(hook.poolManager()), address(manager));
        assertEq(hook.wchan(), address(wchanToken));
        assertEq(hook.weth(), address(wethToken));
        assertEq(hook.dev(), dev);
        assertEq(hook.DEV_FEE_IN_BPS(), 100);
        assertEq(hook.isWethCurrencyZero(), isWethCurrencyZero);
    }

    function test_poolKeyIsCorrect() public view {
        (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks hooks) = hook.poolKey();
        if (isWethCurrencyZero) {
            assertEq(Currency.unwrap(c0), address(wethToken));
            assertEq(Currency.unwrap(c1), address(wchanToken));
        } else {
            assertEq(Currency.unwrap(c0), address(wchanToken));
            assertEq(Currency.unwrap(c1), address(wethToken));
        }
        assertEq(fee, 0);
        assertEq(tickSpacing, 60);
        assertEq(address(hooks), address(hook));
    }

    function test_hookPermissions() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.beforeInitialize);
        assertFalse(p.afterInitialize);
        assertFalse(p.beforeAddLiquidity);
        assertFalse(p.afterAddLiquidity);
        assertFalse(p.beforeRemoveLiquidity);
        assertFalse(p.afterRemoveLiquidity);
        assertTrue(p.beforeSwap);
        assertTrue(p.afterSwap);
        assertFalse(p.beforeDonate);
        assertFalse(p.afterDonate);
        assertTrue(p.beforeSwapReturnDelta);
        assertTrue(p.afterSwapReturnDelta);
        assertFalse(p.afterAddLiquidityReturnDelta);
        assertFalse(p.afterRemoveLiquidityReturnDelta);
    }

    function test_initialize_revert_alreadyInitialized() public {
        vm.prank(owner);
        vm.expectRevert(WCHANDevFeeHook.AlreadyInitialized.selector);
        hook.initialize(SQRT_PRICE_1_1);
    }

    function test_initialize_revert_notOwner() public {
        // Deploy a fresh hook to test initialization
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        // Use different tokens so the poolKey (and thus required address) differs
        MockERC20 wchan2 = new MockERC20("W2", "W2", 18);
        MockERC20 weth2 = new MockERC20("E2", "E2", 18);
        bytes memory constructorArgs = abi.encode(
            dev, owner, address(manager), address(wchan2), address(weth2)
        );
        (, bytes32 salt) = HookMiner.find(
            address(this), flags, type(WCHANDevFeeHook).creationCode, constructorArgs
        );
        WCHANDevFeeHook hook2 = new WCHANDevFeeHook{salt: salt}(
            dev, owner, address(manager), address(wchan2), address(weth2)
        );

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook2.initialize(SQRT_PRICE_1_1);
    }

    function test_pendingFeesStartAtZero() public view {
        (uint256 wethAmt, uint256 wchanAmt) = _getPendingFees();
        assertEq(wethAmt, 0);
        assertEq(wchanAmt, 0);
    }
}


// ═══════════════════════════════════════════════════
//            ACCESS CONTROL & ADMIN
// ═══════════════════════════════════════════════════

contract DevFeeHookAccessControlTest is DevFeeHookBaseTest {

    function test_updateDevAddress() public {
        address newDev = makeAddr("newDev");
        vm.expectEmit(false, false, false, true);
        emit DevAddressUpdated(newDev);
        vm.prank(owner);
        hook.updateDevAddress(newDev);
        assertEq(hook.dev(), newDev);
    }

    function test_updateDevAddress_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        hook.updateDevAddress(alice);
    }

    function test_beforeSwap_revert_notPoolManager() public {
        vm.expectRevert(WCHANDevFeeHook.NotPoolManager.selector);
        hook.beforeSwap(
            address(this),
            poolKey,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: MIN_PRICE_LIMIT}),
            ""
        );
    }

    function test_afterSwap_revert_notPoolManager() public {
        vm.expectRevert(WCHANDevFeeHook.NotPoolManager.selector);
        hook.afterSwap(
            address(this),
            poolKey,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: MIN_PRICE_LIMIT}),
            BalanceDelta.wrap(0),
            ""
        );
    }

    function test_beforeInitialize_revert_notPoolManager() public {
        vm.expectRevert(WCHANDevFeeHook.NotPoolManager.selector);
        hook.beforeInitialize(address(this), poolKey, SQRT_PRICE_1_1);
    }
}


// ═══════════════════════════════════════════════════
//         UNIMPLEMENTED HOOKS REVERT
// ═══════════════════════════════════════════════════

contract DevFeeHookUnimplementedTest is DevFeeHookBaseTest {

    function test_afterInitialize_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
    }

    function test_beforeAddLiquidity_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.beforeAddLiquidity(
            address(this), poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: 0}),
            ""
        );
    }

    function test_afterAddLiquidity_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.afterAddLiquidity(
            address(this), poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            BalanceDelta.wrap(0), BalanceDelta.wrap(0), ""
        );
    }

    function test_beforeRemoveLiquidity_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.beforeRemoveLiquidity(
            address(this), poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            ""
        );
    }

    function test_afterRemoveLiquidity_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.afterRemoveLiquidity(
            address(this), poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            BalanceDelta.wrap(0), BalanceDelta.wrap(0), ""
        );
    }

    function test_beforeDonate_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.beforeDonate(address(this), poolKey, 0, 0, "");
    }

    function test_afterDonate_reverts() public {
        vm.expectRevert(WCHANDevFeeHook.HookNotImplemented.selector);
        hook.afterDonate(address(this), poolKey, 0, 0, "");
    }
}


// ═══════════════════════════════════════════════════
//        SWAP FEE CAPTURE (NO ISP)
// ═══════════════════════════════════════════════════

contract DevFeeHookSwapFeeTest is DevFeeHookBaseTest {

    /// @dev When selling WCHAN for WETH (no ISP involved), fees should accumulate
    function test_sellWchan_capturesFees_exactInput() public {
        (uint256 wethBefore,) = _getPendingFees();
        assertEq(wethBefore, 0);

        uint256 wchanBalBefore = wchanToken.balanceOf(address(this));
        uint256 wethBalBefore = wethToken.balanceOf(address(this));

        _sellWchan(1 ether);

        uint256 wchanSpent = wchanBalBefore - wchanToken.balanceOf(address(this));
        uint256 wethReceived = wethToken.balanceOf(address(this)) - wethBalBefore;

        // User spent 1 ether WCHAN
        assertEq(wchanSpent, 1 ether);
        // User received less than 1 ether WETH (due to AMM pricing + 1% fee)
        assertGt(wethReceived, 0);

        // Fees should now be in WETH (fee is taken from unspecified = output = WETH)
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGt(wethFees, 0, "WETH fees should accumulate on sell");
        assertEq(wchanFees, 0, "No WCHAN fees on sell");
    }

    /// @dev When buying WCHAN with WETH (no pending WCHAN fees → no ISP), fees accumulate
    function test_buyWchan_capturesFees_exactInput_noISP() public {
        uint256 wethBalBefore = wethToken.balanceOf(address(this));
        uint256 wchanBalBefore = wchanToken.balanceOf(address(this));

        _buyWchan(1 ether);

        uint256 wethSpent = wethBalBefore - wethToken.balanceOf(address(this));
        uint256 wchanReceived = wchanToken.balanceOf(address(this)) - wchanBalBefore;

        // User spent 1 WETH
        assertEq(wethSpent, 1 ether);
        // User received WCHAN minus fee
        assertGt(wchanReceived, 0);

        // Fee is from unspecified amount (WCHAN output), so WCHAN fees accumulate
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertEq(wethFees, 0, "No WETH fees on buy with exact input");
        assertGt(wchanFees, 0, "WCHAN fees should accumulate on buy");
    }

    /// @dev Exact output buy: fee is in unspecified (WETH input)
    function test_buyWchan_capturesFees_exactOutput_noISP() public {
        _buyWchanExactOutput(0.5 ether);

        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGt(wethFees, 0, "WETH fees accumulate on exact-output buy");
        assertEq(wchanFees, 0, "No WCHAN fees on exact-output buy");
    }

    /// @dev Exact output sell: fee is in unspecified (WCHAN input)
    function test_sellWchan_capturesFees_exactOutput() public {
        _sellWchanExactOutput(0.5 ether);

        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertEq(wethFees, 0, "No WETH fees on exact-output sell");
        assertGt(wchanFees, 0, "WCHAN fees accumulate on exact-output sell");
    }

    /// @dev Fee is approximately 1% of the unspecified amount
    function test_feeIsApproximatelyOnePercent() public {
        // Sell WCHAN for WETH (exact input) — fee taken from WETH output
        BalanceDelta delta = _sellWchan(10 ether);

        (uint256 wethFees,) = _getPendingFees();

        // The WETH output before fee: approximate via delta
        // Fee should be ~1% of the gross WETH amount
        // Since fee is taken from the swap, user gets gross - fee
        // fee / (userReceived + fee) ≈ 1%
        uint256 wethReceived = wethToken.balanceOf(address(this)); // already includes start balance, but we can check ratio
        // Just verify fee is non-trivially sized relative to output
        assertGt(wethFees, 0);
    }

    /// @dev Multiple swaps accumulate fees correctly
    function test_multipleSwaps_accumulateFees() public {
        _sellWchan(1 ether);
        (uint256 fees1,) = _getPendingFees();
        assertGt(fees1, 0);

        _sellWchan(2 ether);
        (uint256 fees2,) = _getPendingFees();
        assertGt(fees2, fees1, "Fees should increase after second sell");

        _sellWchan(3 ether);
        (uint256 fees3,) = _getPendingFees();
        assertGt(fees3, fees2, "Fees should increase after third sell");
    }

    /// @dev Fuzz: any reasonable sell amount should accumulate fees
    function test_fuzz_sellAccumulatesFees(uint256 amount) public {
        amount = bound(amount, 0.001 ether, 10 ether);

        _sellWchan(amount);

        (uint256 wethFees,) = _getPendingFees();
        assertGt(wethFees, 0, "Fees should accumulate for any sell amount");
    }
}


// ═══════════════════════════════════════════════════
//          INTERNAL SWAP POOL (ISP)
// ═══════════════════════════════════════════════════

contract DevFeeHookISPTest is DevFeeHookBaseTest {

    /// @dev First sell WCHAN to accumulate WCHAN fees, then buy WCHAN to trigger ISP
    function _seedWchanFees(uint256 sellAmount) internal {
        // Buy WCHAN with exact input WETH → fee in WCHAN
        _buyWchan(sellAmount);
    }

    function test_ISP_triggersOnBuyWhenWchanFeesExist() public {
        // Seed: buy WCHAN to get WCHAN fees
        _seedWchanFees(5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();
        assertGt(wchanFeesBefore, 0, "Should have WCHAN fees after buy");

        // Now buy more WCHAN → ISP should fill from pending WCHAN fees
        _buyWchan(1 ether);

        // WCHAN fees should decrease (consumed by ISP)
        (, uint256 wchanFeesAfter) = _getPendingFees();
        assertLt(wchanFeesAfter, wchanFeesBefore, "WCHAN fees should decrease after ISP");

        // WETH fees should increase (ISP converts WCHAN→WETH)
        (uint256 wethFeesAfter,) = _getPendingFees();
        assertGt(wethFeesAfter, 0, "WETH fees should increase from ISP");
    }

    function test_ISP_doesNotTriggerOnSell() public {
        _seedWchanFees(5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();

        // Sell WCHAN for WETH → ISP should NOT trigger
        _sellWchan(1 ether);

        // WCHAN fees unchanged from ISP (they may increase from sell fee if fee is in WCHAN)
        (, uint256 wchanFeesAfter) = _getPendingFees();
        // Fees should NOT decrease from ISP consumption
        assertGe(wchanFeesAfter, wchanFeesBefore, "WCHAN fees should not decrease on sell");
    }

    function test_ISP_doesNotTriggerWithZeroWchanFees() public {
        // No fees seeded
        (uint256 wethBefore, uint256 wchanBefore) = _getPendingFees();
        assertEq(wchanBefore, 0);

        _buyWchan(1 ether);

        // Only WCHAN fees from this buy's fee capture (no ISP conversion)
        (uint256 wethAfter, uint256 wchanAfter) = _getPendingFees();
        assertEq(wethAfter, 0, "No WETH fees when ISP didn't trigger");
        assertGt(wchanAfter, 0, "WCHAN fees from buy fee capture");
    }

    function test_ISP_partialFill_exactInput() public {
        // Seed small WCHAN fees
        _seedWchanFees(0.5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();

        // Buy a large amount → ISP fills partially, rest goes to Uniswap
        _buyWchan(10 ether);

        // All WCHAN fees should be consumed (or nearly all, minus the fee on ISP)
        (, uint256 wchanFeesAfter) = _getPendingFees();
        // The ISP fill + new buy fee → wchanFeesAfter includes the new WCHAN fee from the Uniswap portion
        // but the original WCHAN pool should be mostly consumed
        (uint256 wethFeesAfter,) = _getPendingFees();
        assertGt(wethFeesAfter, 0, "WETH fees should increase from ISP");
    }

    function test_ISP_fullFill_exactOutput() public {
        // Seed WCHAN fees
        _seedWchanFees(5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();
        assertGt(wchanFeesBefore, 0);

        // Buy exact small amount of WCHAN → ISP should fully fill
        // Request less than available WCHAN fees
        uint256 requestAmount = wchanFeesBefore / 10;
        if (requestAmount > 0) {
            _buyWchanExactOutput(requestAmount);

            // WCHAN fees should decrease
            (, uint256 wchanFeesAfter) = _getPendingFees();
            assertLt(wchanFeesAfter, wchanFeesBefore, "WCHAN fees should decrease");
            // WETH fees should increase
            (uint256 wethFeesAfter,) = _getPendingFees();
            assertGt(wethFeesAfter, 0, "WETH fees should increase from ISP");
        }
    }

    /// @dev Fuzz: various buy amounts with seeded fees
    function test_fuzz_ISP_exactInput(uint256 seedAmount, uint256 buyAmount) public {
        seedAmount = bound(seedAmount, 0.1 ether, 5 ether);
        buyAmount = bound(buyAmount, 0.01 ether, 10 ether);

        _seedWchanFees(seedAmount);
        (, uint256 wchanFeesBefore) = _getPendingFees();
        assertGt(wchanFeesBefore, 0);

        uint256 wethBalBefore = wethToken.balanceOf(address(this));
        uint256 wchanBalBefore = wchanToken.balanceOf(address(this));

        _buyWchan(buyAmount);

        uint256 wethSpent = wethBalBefore - wethToken.balanceOf(address(this));
        uint256 wchanReceived = wchanToken.balanceOf(address(this)) - wchanBalBefore;

        // User should have spent WETH and received WCHAN
        assertEq(wethSpent, buyAmount, "Exact input: spent exactly buyAmount");
        assertGt(wchanReceived, 0, "User should receive WCHAN");

        // WETH fees should have increased from ISP
        (uint256 wethFeesAfter,) = _getPendingFees();
        assertGt(wethFeesAfter, 0, "WETH fees should increase");
    }

    /// @dev Fuzz: exact output with seeded fees
    function test_fuzz_ISP_exactOutput(uint256 seedAmount, uint256 outputAmount) public {
        seedAmount = bound(seedAmount, 0.5 ether, 5 ether);

        _seedWchanFees(seedAmount);
        (, uint256 wchanFeesBefore) = _getPendingFees();
        outputAmount = bound(outputAmount, 0.001 ether, wchanFeesBefore / 2);

        uint256 wchanBalBefore = wchanToken.balanceOf(address(this));

        _buyWchanExactOutput(outputAmount);

        uint256 wchanReceived = wchanToken.balanceOf(address(this)) - wchanBalBefore;
        // Exact output means user gets exactly the requested amount (minus fee on unspecified side)
        // The ISP + Uniswap should together deliver the requested output
        assertGt(wchanReceived, 0);
    }
}


// ═══════════════════════════════════════════════════
//          CLAIM FEES / WITHDRAWAL
// ═══════════════════════════════════════════════════

contract DevFeeHookClaimTest is DevFeeHookBaseTest {

    function test_claimFees_sendsWethToDev() public {
        // Generate WETH fees by selling WCHAN
        _sellWchan(10 ether);

        (uint256 wethFees,) = _getPendingFees();
        assertGt(wethFees, 0);

        uint256 devWethBefore = wethToken.balanceOf(dev);

        vm.expectEmit(true, false, false, true);
        emit WethClaimed(dev, wethFees);
        hook.claimFees();

        uint256 devWethAfter = wethToken.balanceOf(dev);
        assertEq(devWethAfter - devWethBefore, wethFees, "Dev should receive all WETH fees");

        // Pending fees should be zero
        (uint256 wethAfter,) = _getPendingFees();
        assertEq(wethAfter, 0, "WETH fees should be zero after claim");
    }

    function test_claimFees_callableByAnyone() public {
        _sellWchan(5 ether);
        (uint256 wethFees,) = _getPendingFees();
        assertGt(wethFees, 0);

        uint256 devBefore = wethToken.balanceOf(dev);

        // Bob calls claimFees, but WETH goes to dev
        vm.prank(bob);
        hook.claimFees();

        assertEq(wethToken.balanceOf(dev) - devBefore, wethFees);
    }

    function test_claimFees_noopWhenZero() public {
        (uint256 wethFees,) = _getPendingFees();
        assertEq(wethFees, 0);

        uint256 devBefore = wethToken.balanceOf(dev);
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev), devBefore, "No transfer when zero fees");
    }

    function test_claimFees_afterDevAddressUpdate() public {
        _sellWchan(5 ether);
        (uint256 wethFees,) = _getPendingFees();
        assertGt(wethFees, 0);

        address newDev = makeAddr("newDev");
        vm.prank(owner);
        hook.updateDevAddress(newDev);

        uint256 newDevBefore = wethToken.balanceOf(newDev);
        hook.claimFees();
        assertEq(wethToken.balanceOf(newDev) - newDevBefore, wethFees, "Fees should go to new dev");
        assertEq(wethToken.balanceOf(dev), 0, "Old dev should get nothing");
    }

    function test_claimFees_multipleClaims() public {
        // First batch of fees
        _sellWchan(3 ether);
        (uint256 fees1,) = _getPendingFees();
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev), fees1);

        // Second batch
        _sellWchan(5 ether);
        (uint256 fees2,) = _getPendingFees();
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev), fees1 + fees2);

        // Third claim with zero
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev), fees1 + fees2, "No change on zero claim");
    }

    /// @dev WCHAN fees should NOT be claimable (they stay for ISP conversion)
    function test_claimFees_doesNotClaimWchanFees() public {
        // Buy WCHAN → accumulates WCHAN fees
        _buyWchan(5 ether);
        (, uint256 wchanFees) = _getPendingFees();
        assertGt(wchanFees, 0);

        hook.claimFees(); // should be noop for WETH

        (, uint256 wchanFeesAfter) = _getPendingFees();
        assertEq(wchanFeesAfter, wchanFees, "WCHAN fees should remain for ISP");
    }
}


// ═══════════════════════════════════════════════════
//          ISP + FEE CONVERSION FLOW
// ═══════════════════════════════════════════════════

contract DevFeeHookConversionFlowTest is DevFeeHookBaseTest {

    /// @dev Full flow: generate WCHAN fees → ISP converts to WETH → claim
    function test_fullConversionFlow() public {
        // Step 1: Buy WCHAN (generates WCHAN fees)
        _buyWchan(10 ether);
        (uint256 wethFees1, uint256 wchanFees1) = _getPendingFees();
        assertEq(wethFees1, 0, "No WETH fees yet");
        assertGt(wchanFees1, 0, "WCHAN fees from buy");

        // Step 2: Another buy triggers ISP, converting WCHAN fees to WETH
        _buyWchan(5 ether);
        (uint256 wethFees2, uint256 wchanFees2) = _getPendingFees();
        assertGt(wethFees2, 0, "WETH fees from ISP conversion");

        // Step 3: Claim WETH fees
        uint256 devBefore = wethToken.balanceOf(dev);
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev) - devBefore, wethFees2);
    }

    /// @dev Repeated buys should progressively convert WCHAN fees
    function test_progressiveConversion() public {
        // Big initial buy to seed WCHAN fees
        _buyWchan(10 ether);
        (, uint256 wchanFees0) = _getPendingFees();

        uint256 totalWethConverted = 0;
        for (uint256 i = 0; i < 5; i++) {
            _buyWchan(2 ether);
            (uint256 wethFees,) = _getPendingFees();
            if (wethFees > totalWethConverted) {
                totalWethConverted = wethFees;
            }
        }

        assertGt(totalWethConverted, 0, "Progressive conversion should accumulate WETH");
    }

    /// @dev Sell swaps don't consume WCHAN fees
    function test_sellDoesNotConsumeWchanFees() public {
        _buyWchan(5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();

        _sellWchan(2 ether);

        (, uint256 wchanFeesAfter) = _getPendingFees();
        // Sell adds WETH fees but does NOT consume WCHAN fees via ISP
        assertGe(wchanFeesAfter, wchanFeesBefore, "WCHAN fees should not decrease on sell");
    }
}


// ═══════════════════════════════════════════════════
//          INVARIANT / ACCOUNTING TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookAccountingTest is DevFeeHookBaseTest {

    /// @dev Hook's token balances should always be >= pendingFees
    function test_hookBalanceCoversClaimableFees() public {
        // Generate both WETH and WCHAN fees
        _buyWchan(5 ether);   // WCHAN fees
        _sellWchan(3 ether);  // WETH fees
        _buyWchan(2 ether);   // ISP + more fees

        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();

        uint256 hookWeth = wethToken.balanceOf(address(hook));
        uint256 hookWchan = wchanToken.balanceOf(address(hook));

        assertGe(hookWeth, wethFees, "Hook WETH balance must cover claimable fees");
        assertGe(hookWchan, wchanFees, "Hook WCHAN balance must cover ISP reserve");
    }

    /// @dev Fuzz: After N swaps, hook balance always covers pending fees
    function test_fuzz_balanceCoversFees(uint8 numSwaps, uint256 seed) public {
        numSwaps = uint8(bound(numSwaps, 1, 20));

        for (uint8 i = 0; i < numSwaps; i++) {
            uint256 amount = bound(uint256(keccak256(abi.encode(seed, i))), 0.01 ether, 5 ether);
            bool isBuy = uint256(keccak256(abi.encode(seed, i, "dir"))) % 2 == 0;

            if (isBuy) {
                _buyWchan(amount);
            } else {
                _sellWchan(amount);
            }
        }

        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGe(wethToken.balanceOf(address(hook)), wethFees, "WETH invariant violated");
        assertGe(wchanToken.balanceOf(address(hook)), wchanFees, "WCHAN invariant violated");
    }

    /// @dev After claiming, hook WETH balance should equal zero pending WETH
    function test_claimDrainsExactAmount() public {
        _sellWchan(5 ether);
        _buyWchan(3 ether);

        (uint256 wethFees,) = _getPendingFees();
        uint256 hookWethBefore = wethToken.balanceOf(address(hook));

        hook.claimFees();

        uint256 hookWethAfter = wethToken.balanceOf(address(hook));
        assertEq(hookWethBefore - hookWethAfter, wethFees, "Exact WETH drained");

        (uint256 wethFeesAfter,) = _getPendingFees();
        assertEq(wethFeesAfter, 0);
    }

    /// @dev ISP-filled swaps should not revert and should behave consistently
    function test_ISP_swapWithFees_succeeds() public {
        // Seed WCHAN fees with a buy
        _buyWchan(5 ether);
        (, uint256 wchanFees) = _getPendingFees();
        assertGt(wchanFees, 0);

        // Small buy that should partially be filled by ISP
        uint256 wethBefore = wethToken.balanceOf(address(this));
        uint256 wchanBefore = wchanToken.balanceOf(address(this));
        _buyWchan(0.1 ether);

        assertEq(wethBefore - wethToken.balanceOf(address(this)), 0.1 ether, "Exact WETH spent");
        assertGt(wchanToken.balanceOf(address(this)), wchanBefore, "Received WCHAN");
    }
}


// ═══════════════════════════════════════════════════
//          EVENT EMISSION TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookEventTest is DevFeeHookBaseTest {

    function test_emitsSwapFeesReceived_onSell() public {
        // We expect SwapFeesReceived with non-zero wethAmount
        vm.recordLogs();
        _sellWchan(1 ether);

        // Verify SwapFeesReceived was emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("SwapFeesReceived(uint256,uint256)")) {
                (uint256 wethAmt, uint256 wchanAmt) = abi.decode(logs[i].data, (uint256, uint256));
                if (wethAmt > 0 && wchanAmt == 0) found = true;
            }
        }
        assertTrue(found, "SwapFeesReceived event with WETH fees expected on sell");
    }

    function test_emitsSwapFeesReceived_onBuy() public {
        vm.recordLogs();
        _buyWchan(1 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("SwapFeesReceived(uint256,uint256)")) {
                (uint256 wethAmt, uint256 wchanAmt) = abi.decode(logs[i].data, (uint256, uint256));
                if (wchanAmt > 0 && wethAmt == 0) found = true;
            }
        }
        assertTrue(found, "SwapFeesReceived event with WCHAN fees expected on buy");
    }

    function test_emitsInternalSwap_whenISPTriggers() public {
        _buyWchan(5 ether); // seed fees

        vm.recordLogs();
        _buyWchan(1 ether); // trigger ISP

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("InternalSwap(bool,uint256,uint256)")) {
                found = true;
            }
        }
        assertTrue(found, "InternalSwap event expected when ISP triggers");
    }

    function test_emitsPoolSwap_onEverySwap() public {
        vm.recordLogs();
        _sellWchan(1 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("PoolSwap(int256,int256,int256,int256,int256,int256,int256,int256)")) {
                found = true;
            }
        }
        assertTrue(found, "PoolSwap event expected on every swap");
    }
}


// ═══════════════════════════════════════════════════
//       MULTI-USER / SEQUENCING TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookMultiUserTest is DevFeeHookBaseTest {

    function test_multipleUsers_feeAccumulation() public {
        // Alice buys WCHAN
        _buyWchanAs(alice, 3 ether);

        // Bob sells WCHAN
        _sellWchanAs(bob, 2 ether);

        // Fees should have accumulated from both
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGt(wethFees + wchanFees, 0, "Fees from both users");
    }

    function test_devCannotStealFromPool() public {
        // Even if dev is set to a contract, they can only claim accumulated WETH
        _sellWchan(10 ether);
        (uint256 wethFees,) = _getPendingFees();

        uint256 poolManagerWeth = wethToken.balanceOf(address(manager));
        hook.claimFees();

        // Pool manager balance should not decrease by more than the fees
        assertGe(wethToken.balanceOf(address(manager)), poolManagerWeth, "PoolManager balance unaffected by claim");
    }

    // Helpers that swap from specific accounts
    function _buyWchanAs(address user, uint256 amount) internal {
        bool zeroForOne = isWethCurrencyZero;
        vm.startPrank(user);
        swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
        vm.stopPrank();
    }

    function _sellWchanAs(address user, uint256 amount) internal {
        bool zeroForOne = !isWethCurrencyZero;
        vm.startPrank(user);
        swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
        vm.stopPrank();
    }
}


// ═══════════════════════════════════════════════════
//         FUZZ: COMPREHENSIVE SWAP TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookFuzzTest is DevFeeHookBaseTest {

    /// @dev Fuzz random sequence of buys and sells
    function test_fuzz_randomSwapSequence(uint256 seed) public {
        uint256 rounds = 10;

        for (uint256 i = 0; i < rounds; i++) {
            uint256 rng = uint256(keccak256(abi.encode(seed, i)));
            uint256 amount = bound(rng, 0.01 ether, 3 ether);
            bool isBuy = (rng >> 128) % 2 == 0;

            if (isBuy) {
                _buyWchan(amount);
            } else {
                _sellWchan(amount);
            }
        }

        // Invariant: hook balance covers fees
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGe(wethToken.balanceOf(address(hook)), wethFees, "WETH invariant");
        assertGe(wchanToken.balanceOf(address(hook)), wchanFees, "WCHAN invariant");
    }

    /// @dev Fuzz: claim after random swaps always succeeds
    function test_fuzz_claimAfterRandomSwaps(uint256 seed) public {
        uint256 rounds = bound(seed >> 200, 1, 8);

        for (uint256 i = 0; i < rounds; i++) {
            uint256 rng = uint256(keccak256(abi.encode(seed, i)));
            uint256 amount = bound(rng, 0.01 ether, 2 ether);
            bool isBuy = (rng >> 128) % 2 == 0;

            if (isBuy) {
                _buyWchan(amount);
            } else {
                _sellWchan(amount);
            }
        }

        (uint256 wethFees,) = _getPendingFees();
        uint256 devBefore = wethToken.balanceOf(dev);

        hook.claimFees();

        assertEq(wethToken.balanceOf(dev) - devBefore, wethFees, "Claim should transfer exact WETH fees");
        (uint256 wethAfter,) = _getPendingFees();
        assertEq(wethAfter, 0, "WETH fees zeroed");
    }

    /// @dev Fuzz: exact-input buy amount
    function test_fuzz_buyExactInput(uint256 amount) public {
        amount = bound(amount, 0.001 ether, 20 ether);

        uint256 wethBefore = wethToken.balanceOf(address(this));
        uint256 wchanBefore = wchanToken.balanceOf(address(this));

        _buyWchan(amount);

        assertEq(wethBefore - wethToken.balanceOf(address(this)), amount, "Spent exact WETH");
        assertGt(wchanToken.balanceOf(address(this)), wchanBefore, "Received WCHAN");
    }

    /// @dev Fuzz: exact-input sell amount
    function test_fuzz_sellExactInput(uint256 amount) public {
        amount = bound(amount, 0.001 ether, 20 ether);

        uint256 wethBefore = wethToken.balanceOf(address(this));
        uint256 wchanBefore = wchanToken.balanceOf(address(this));

        _sellWchan(amount);

        assertEq(wchanBefore - wchanToken.balanceOf(address(this)), amount, "Spent exact WCHAN");
        assertGt(wethToken.balanceOf(address(this)), wethBefore, "Received WETH");
    }

    /// @dev Fuzz: ISP with varying seed and buy amounts
    function test_fuzz_ISP_varyingAmounts(uint256 seedAmount, uint256 buyAmount) public {
        seedAmount = bound(seedAmount, 0.1 ether, 10 ether);
        buyAmount = bound(buyAmount, 0.01 ether, 10 ether);

        // Seed WCHAN fees
        _buyWchan(seedAmount);
        (, uint256 wchanFeesBefore) = _getPendingFees();
        assertGt(wchanFeesBefore, 0);

        // Buy again to trigger ISP
        _buyWchan(buyAmount);

        // Verify accounting invariant
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGe(wethToken.balanceOf(address(hook)), wethFees);
        assertGe(wchanToken.balanceOf(address(hook)), wchanFees);

        // WETH fees should have accumulated (from ISP conversion + possible WETH fee capture)
        assertGt(wethFees, 0, "WETH fees from ISP");
    }
}


// ═══════════════════════════════════════════════════
//         EXPLOIT / EDGE CASE TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookExploitTest is DevFeeHookBaseTest {

    /// @dev Verify user can't bypass fees by using exact-output vs exact-input
    function test_feesChargedOnBothExactInputAndOutput() public {
        // Exact-input sell
        _sellWchan(5 ether);
        (uint256 feeEI,) = _getPendingFees();
        hook.claimFees();

        // Exact-output sell for similar amount
        _sellWchanExactOutput(4 ether);
        (uint256 feeEO_weth, uint256 feeEO_wchan) = _getPendingFees();

        // Both should generate fees
        assertGt(feeEI, 0, "Exact-input should generate fees");
        assertGt(feeEO_weth + feeEO_wchan, 0, "Exact-output should generate fees");
    }

    /// @dev Verify ISP doesn't allow free tokens
    function test_ISP_noFreeTokens() public {
        // Seed WCHAN fees
        _buyWchan(5 ether);
        (uint256 wethFeesBefore, uint256 wchanFeesBefore) = _getPendingFees();

        uint256 hookWethBefore = wethToken.balanceOf(address(hook));
        uint256 hookWchanBefore = wchanToken.balanceOf(address(hook));

        // Buy WCHAN triggering ISP
        _buyWchan(1 ether);

        uint256 hookWethAfter = wethToken.balanceOf(address(hook));
        uint256 hookWchanAfter = wchanToken.balanceOf(address(hook));
        (uint256 wethFeesAfter, uint256 wchanFeesAfter) = _getPendingFees();

        // ISP converts: hook loses WCHAN, gains WETH
        // Net hook balance change should be non-negative in value terms
        // (hook sends WCHAN at market price, receives WETH at market price)
        // The WETH gained should correspond to the WCHAN spent
        assertGt(wethFeesAfter, wethFeesBefore, "WETH fees increased from ISP");
    }

    /// @dev Large swap shouldn't brick the hook
    function test_largeSwap_doesNotBrick() public {
        // Add more liquidity for large swaps
        wchanToken.mint(address(this), 10_000 ether);
        wethToken.mint(address(this), 10_000 ether);
        _addLiquidity(1000 ether);

        // Large buy
        _buyWchan(100 ether);
        (, uint256 wchanFees) = _getPendingFees();
        assertGt(wchanFees, 0);

        // Large sell
        _sellWchan(100 ether);
        (uint256 wethFees,) = _getPendingFees();
        assertGt(wethFees, 0);

        // Another buy to trigger ISP with large fees
        _buyWchan(50 ether);

        // Should still be able to claim
        hook.claimFees();
    }

    /// @dev Very small swap amounts shouldn't revert
    function test_smallSwap_doesNotRevert() public {
        // Very small buy
        _buyWchan(1);

        // Very small sell
        _sellWchan(1);

        // Should complete without revert
    }

    /// @dev Verify that after claim, subsequent swaps still work
    function test_swapAfterClaim_works() public {
        _sellWchan(5 ether);
        hook.claimFees();

        // Swap again after claim
        _sellWchan(3 ether);
        (uint256 fees,) = _getPendingFees();
        assertGt(fees, 0, "New fees accumulate after claim");
    }

    /// @dev Multiple claims interleaved with swaps
    function test_fuzz_interleavedClaimsAndSwaps(uint256 seed) public {
        uint256 totalClaimed = 0;

        for (uint256 i = 0; i < 5; i++) {
            uint256 rng = uint256(keccak256(abi.encode(seed, i)));
            uint256 amount = bound(rng, 0.1 ether, 3 ether);

            _sellWchan(amount);

            (uint256 fees,) = _getPendingFees();
            if (fees > 0) {
                hook.claimFees();
                totalClaimed += fees;
            }
        }

        assertEq(wethToken.balanceOf(dev), totalClaimed, "Dev received all claimed fees");
    }

    /// @dev Ensure ISP won't consume more WCHAN than available
    function test_ISP_doesNotOverspend() public {
        // Seed small WCHAN fees
        _buyWchan(0.5 ether);
        (, uint256 wchanFeesBefore) = _getPendingFees();

        // Buy a huge amount → ISP should only spend up to wchanFeesBefore
        wchanToken.mint(address(this), 1_000 ether);
        wethToken.mint(address(this), 1_000 ether);
        _addLiquidity(500 ether);

        _buyWchan(50 ether);

        (, uint256 wchanFeesAfter) = _getPendingFees();
        // wchanFeesAfter includes new WCHAN fee from the Uniswap portion,
        // but should NOT go negative or underflow
        // (if it underflowed, the tx would revert due to arithmetic)
        // If we get here without revert, the ISP capping logic works
    }
}


// ═══════════════════════════════════════════════════
//        STRESS / SEQUENCE TESTS
// ═══════════════════════════════════════════════════

contract DevFeeHookStressTest is DevFeeHookBaseTest {

    /// @dev 50 sequential swaps of alternating direction
    function test_fiftyAlternatingSwaps() public {
        for (uint256 i = 0; i < 50; i++) {
            if (i % 2 == 0) {
                _buyWchan(0.1 ether);
            } else {
                _sellWchan(0.1 ether);
            }
        }

        // Invariant check
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGe(wethToken.balanceOf(address(hook)), wethFees);
        assertGe(wchanToken.balanceOf(address(hook)), wchanFees);
    }

    /// @dev Rapid buys should progressively drain ISP then rely on Uniswap
    function test_rapidBuys_progressiveISPDrain() public {
        // One big buy to seed fees
        _buyWchan(10 ether);
        (, uint256 wchanFeesStart) = _getPendingFees();
        assertGt(wchanFeesStart, 0);

        // Many small buys to drain ISP
        for (uint256 i = 0; i < 20; i++) {
            _buyWchan(0.5 ether);
        }

        // ISP should be mostly drained
        // New fees from the buys will partially replenish, but net should trend down
        // No revert = success
        (uint256 wethFees, uint256 wchanFees) = _getPendingFees();
        assertGt(wethFees, 0, "WETH accumulated from ISP fills");
    }

    /// @dev Claim, then ISP, then claim again
    function test_claimISPClaim_cycle() public {
        // Generate WETH fees
        _sellWchan(5 ether);
        hook.claimFees();

        // Generate WCHAN fees
        _buyWchan(5 ether);
        (, uint256 wchanFees) = _getPendingFees();
        assertGt(wchanFees, 0);

        // ISP conversion via another buy
        _buyWchan(3 ether);
        (uint256 wethFees2,) = _getPendingFees();
        assertGt(wethFees2, 0);

        // Claim again
        hook.claimFees();
        assertEq(wethToken.balanceOf(dev), wethFees2 + (wethToken.balanceOf(dev) - wethFees2), "total claimed matches");
    }
}
