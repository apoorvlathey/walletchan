// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {CustomRevert} from "@uniswap/v4-core/src/libraries/CustomRevert.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WCHANWrapHook} from "@src/WCHANWrapHook.sol";
import {WCHAN} from "@src/WCHAN.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";

/// @dev Minimal ERC20 with public mint, deployed at OLD_TOKEN address
contract MockOldToken is ERC20 {
    constructor() ERC20("OldWalletChan", "OLDWCHAN") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract WCHANWrapHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    address constant OLD_TOKEN_ADDR = 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07;
    uint256 constant FUND_AMOUNT = 100_000e18;

    WCHANWrapHook public hook;
    WCHAN public wchan;
    MockOldToken public oldToken;

    PoolKey poolKey;
    bool isWchanCurrency0; // true if address(wchan) < OLD_TOKEN_ADDR

    function setUp() public {
        // 1. Deploy MockOldToken at the hardcoded OLD_TOKEN address
        MockOldToken mockImpl = new MockOldToken();
        vm.etch(OLD_TOKEN_ADDR, address(mockImpl).code);
        oldToken = MockOldToken(OLD_TOKEN_ADDR);

        // 2. Deploy PoolManager and test routers
        deployFreshManagerAndRouters();

        // 3. Deploy WCHAN
        wchan = new WCHAN("https://example.com/token.json");

        // 4. Deploy WCHANWrapHook at an address with the correct flag bits
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(address(manager), address(wchan));
        (address hookAddr, bytes32 salt) = HookMiner.find(
            address(this), flags, type(WCHANWrapHook).creationCode, constructorArgs
        );
        hook = new WCHANWrapHook{salt: salt}(address(manager), wchan);
        require(address(hook) == hookAddr, "Hook address mismatch");

        // 5. Sort currencies
        isWchanCurrency0 = address(wchan) < OLD_TOKEN_ADDR;
        (Currency c0, Currency c1) = isWchanCurrency0
            ? (Currency.wrap(address(wchan)), Currency.wrap(OLD_TOKEN_ADDR))
            : (Currency.wrap(OLD_TOKEN_ADDR), Currency.wrap(address(wchan)));

        // 6. Initialize pool (fee = 0, tickSpacing = 60)
        poolKey = PoolKey(c0, c1, 0, 60, IHooks(address(hook)));
        manager.initialize(poolKey, SQRT_PRICE_1_1);

        // 7. Fund PoolManager with OLD_TOKEN (needed for hook's take during swaps)
        oldToken.mint(address(manager), FUND_AMOUNT);

        // 8. Wrap OLD_TOKEN → WCHAN and fund PoolManager with WCHAN
        //    Also seeds WCHAN contract with OLD_TOKEN for unwrap operations
        oldToken.mint(address(this), FUND_AMOUNT * 2);
        oldToken.approve(address(wchan), FUND_AMOUNT * 2);
        wchan.wrap(FUND_AMOUNT * 2);
        wchan.transfer(address(manager), FUND_AMOUNT);
        // Test contract keeps FUND_AMOUNT WCHAN for swaps

        // 9. Give test contract OLD_TOKEN for swaps
        oldToken.mint(address(this), FUND_AMOUNT);

        // 10. Approve swap router
        oldToken.approve(address(swapRouter), type(uint256).max);
        wchan.approve(address(swapRouter), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════
    //                 CONSTRUCTOR
    // ═══════════════════════════════════════════════════

    function test_constructorSetsImmutables() public view {
        assertEq(address(hook.poolManager()), address(manager));
        assertEq(address(hook.wchan()), address(wchan));
        assertEq(hook.OLD_TOKEN(), OLD_TOKEN_ADDR);
    }

    function test_constructorApprovesOldToken() public view {
        uint256 allowance = IERC20(OLD_TOKEN_ADDR).allowance(address(hook), address(wchan));
        assertEq(allowance, type(uint256).max);
    }

    // ═══════════════════════════════════════════════════
    //               HOOK PERMISSIONS
    // ═══════════════════════════════════════════════════

    function test_hookPermissions() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.beforeInitialize);
        assertFalse(p.afterInitialize);
        assertTrue(p.beforeAddLiquidity);
        assertFalse(p.afterAddLiquidity);
        assertFalse(p.beforeRemoveLiquidity);
        assertFalse(p.afterRemoveLiquidity);
        assertTrue(p.beforeSwap);
        assertFalse(p.afterSwap);
        assertFalse(p.beforeDonate);
        assertFalse(p.afterDonate);
        assertTrue(p.beforeSwapReturnDelta);
        assertFalse(p.afterSwapReturnDelta);
        assertFalse(p.afterAddLiquidityReturnDelta);
        assertFalse(p.afterRemoveLiquidityReturnDelta);
    }

    // ═══════════════════════════════════════════════════
    //            BEFORE INITIALIZE
    // ═══════════════════════════════════════════════════

    function test_beforeInitialize_revert_invalidTokenPair() public {
        Currency randomA = deployMintAndApproveCurrency();
        Currency randomB = deployMintAndApproveCurrency();
        PoolKey memory badKey = PoolKey(randomA, randomB, 0, 60, IHooks(address(hook)));

        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeInitialize.selector,
                abi.encodeWithSelector(WCHANWrapHook.InvalidTokenPair.selector),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        manager.initialize(badKey, SQRT_PRICE_1_1);
    }

    function test_beforeInitialize_revert_oneValidOneInvalid() public {
        Currency random = deployMintAndApproveCurrency();

        // WCHAN paired with a random token (not OLD_TOKEN)
        (Currency c0, Currency c1) = address(wchan) < Currency.unwrap(random)
            ? (Currency.wrap(address(wchan)), random)
            : (random, Currency.wrap(address(wchan)));

        PoolKey memory badKey = PoolKey(c0, c1, 0, 60, IHooks(address(hook)));

        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeInitialize.selector,
                abi.encodeWithSelector(WCHANWrapHook.InvalidTokenPair.selector),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        manager.initialize(badKey, SQRT_PRICE_1_1);
    }

    function test_beforeInitialize_revert_nonZeroFee() public {
        (Currency c0, Currency c1) = isWchanCurrency0
            ? (Currency.wrap(address(wchan)), Currency.wrap(OLD_TOKEN_ADDR))
            : (Currency.wrap(OLD_TOKEN_ADDR), Currency.wrap(address(wchan)));

        PoolKey memory badKey = PoolKey(c0, c1, 3000, 60, IHooks(address(hook)));

        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeInitialize.selector,
                abi.encodeWithSelector(WCHANWrapHook.FeeMustBeZero.selector),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        manager.initialize(badKey, SQRT_PRICE_1_1);
    }

    // ═══════════════════════════════════════════════════
    //            BEFORE ADD LIQUIDITY
    // ═══════════════════════════════════════════════════

    function test_beforeAddLiquidity_reverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeAddLiquidity.selector,
                abi.encodeWithSelector(WCHANWrapHook.CannotAddLiquidity.selector),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: 0}),
            ZERO_BYTES
        );
    }

    // ═══════════════════════════════════════════════════
    //       SWAP: OLD_TOKEN → WCHAN (wrap)
    // ═══════════════════════════════════════════════════

    function test_fuzz_swapOldTokenForWCHAN_exactInput(uint256 amount) public {
        amount = bound(amount, 1, FUND_AMOUNT);

        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactInput(true, amount);

        assertEq(oldToken.balanceOf(address(this)), oldBal - amount, "old token spent");
        assertEq(wchan.balanceOf(address(this)), wchanBal + amount, "wchan received");
    }

    function test_fuzz_swapOldTokenForWCHAN_exactOutput(uint256 amount) public {
        amount = bound(amount, 1, FUND_AMOUNT);

        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactOutput(true, amount);

        // 1:1 rate: exact output of X costs exactly X
        assertEq(oldToken.balanceOf(address(this)), oldBal - amount, "old token spent");
        assertEq(wchan.balanceOf(address(this)), wchanBal + amount, "wchan received");
    }

    // ═══════════════════════════════════════════════════
    //       SWAP: WCHAN → OLD_TOKEN (unwrap)
    // ═══════════════════════════════════════════════════

    function test_fuzz_swapWCHANForOldToken_exactInput(uint256 amount) public {
        amount = bound(amount, 1, FUND_AMOUNT);

        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactInput(false, amount);

        assertEq(oldToken.balanceOf(address(this)), oldBal + amount, "old token received");
        assertEq(wchan.balanceOf(address(this)), wchanBal - amount, "wchan spent");
    }

    function test_fuzz_swapWCHANForOldToken_exactOutput(uint256 amount) public {
        amount = bound(amount, 1, FUND_AMOUNT);

        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactOutput(false, amount);

        assertEq(oldToken.balanceOf(address(this)), oldBal + amount, "old token received");
        assertEq(wchan.balanceOf(address(this)), wchanBal - amount, "wchan spent");
    }

    // ═══════════════════════════════════════════════════
    //        SWAP: ROUND TRIP & INVARIANTS
    // ═══════════════════════════════════════════════════

    function test_fuzz_swapRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, FUND_AMOUNT / 2);

        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactInput(true, amount);  // wrap
        _swapExactInput(false, amount); // unwrap

        assertEq(oldToken.balanceOf(address(this)), oldBal, "old token unchanged after round trip");
        assertEq(wchan.balanceOf(address(this)), wchanBal, "wchan unchanged after round trip");
    }

    function test_swapMultipleSequential() public {
        uint256 oldBal = oldToken.balanceOf(address(this));
        uint256 wchanBal = wchan.balanceOf(address(this));

        _swapExactInput(true, 100e18);
        _swapExactInput(true, 200e18);
        _swapExactInput(true, 50e18);

        assertEq(oldToken.balanceOf(address(this)), oldBal - 350e18);
        assertEq(wchan.balanceOf(address(this)), wchanBal + 350e18);

        // Swap everything back
        _swapExactInput(false, 350e18);

        assertEq(oldToken.balanceOf(address(this)), oldBal);
        assertEq(wchan.balanceOf(address(this)), wchanBal);
    }

    function test_hookDoesNotAccumulateTokens() public {
        uint256 hookOldBefore = oldToken.balanceOf(address(hook));
        uint256 hookWchanBefore = wchan.balanceOf(address(hook));

        _swapExactInput(true, 100e18);
        _swapExactInput(false, 50e18);

        assertEq(oldToken.balanceOf(address(hook)), hookOldBefore, "hook old token unchanged");
        assertEq(wchan.balanceOf(address(hook)), hookWchanBefore, "hook wchan unchanged");
    }

    // ═══════════════════════════════════════════════════
    //              ACCESS CONTROL
    // ═══════════════════════════════════════════════════

    function test_beforeSwap_revert_notPoolManager() public {
        vm.expectRevert(WCHANWrapHook.NotPoolManager.selector);
        hook.beforeSwap(
            address(this),
            poolKey,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: MIN_PRICE_LIMIT}),
            ""
        );
    }

    function test_beforeAddLiquidity_revert_notPoolManager() public {
        vm.expectRevert(WCHANWrapHook.NotPoolManager.selector);
        hook.beforeAddLiquidity(
            address(this),
            poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: 0}),
            ""
        );
    }

    function test_beforeInitialize_revert_notPoolManager() public {
        vm.expectRevert(WCHANWrapHook.NotPoolManager.selector);
        hook.beforeInitialize(address(this), poolKey, SQRT_PRICE_1_1);
    }

    // ═══════════════════════════════════════════════════
    //           UNIMPLEMENTED HOOKS
    // ═══════════════════════════════════════════════════

    function test_afterInitialize_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.afterInitialize(address(this), poolKey, SQRT_PRICE_1_1, 0);
    }

    function test_afterSwap_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.afterSwap(
            address(this),
            poolKey,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: 0}),
            BalanceDelta.wrap(0),
            ""
        );
    }

    function test_beforeRemoveLiquidity_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.beforeRemoveLiquidity(
            address(this),
            poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            ""
        );
    }

    function test_afterAddLiquidity_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.afterAddLiquidity(
            address(this),
            poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            BalanceDelta.wrap(0),
            BalanceDelta.wrap(0),
            ""
        );
    }

    function test_afterRemoveLiquidity_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.afterRemoveLiquidity(
            address(this),
            poolKey,
            IPoolManager.ModifyLiquidityParams({tickLower: 0, tickUpper: 0, liquidityDelta: 0, salt: 0}),
            BalanceDelta.wrap(0),
            BalanceDelta.wrap(0),
            ""
        );
    }

    function test_beforeDonate_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.beforeDonate(address(this), poolKey, 0, 0, "");
    }

    function test_afterDonate_reverts() public {
        vm.expectRevert(WCHANWrapHook.HookNotImplemented.selector);
        hook.afterDonate(address(this), poolKey, 0, 0, "");
    }

    // ═══════════════════════════════════════════════════
    //                  HELPERS
    // ═══════════════════════════════════════════════════

    /// @param wrapDirection true = OLD_TOKEN→WCHAN, false = WCHAN→OLD_TOKEN
    function _swapExactInput(bool wrapDirection, uint256 amount) internal {
        // OLD_TOKEN is input when wrapping
        // If WCHAN is currency0 (lower addr), then OLD_TOKEN is currency1 → zeroForOne = false for wrap
        bool zeroForOne = wrapDirection ? !isWchanCurrency0 : isWchanCurrency0;

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
    }

    /// @param wrapDirection true = OLD_TOKEN→WCHAN, false = WCHAN→OLD_TOKEN
    function _swapExactOutput(bool wrapDirection, uint256 amount) internal {
        bool zeroForOne = wrapDirection ? !isWchanCurrency0 : isWchanCurrency0;

        swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(amount),
                sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
    }
}
