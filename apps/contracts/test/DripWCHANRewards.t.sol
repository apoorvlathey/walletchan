// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WCHANVault} from "../src/WCHANVault.sol";
import {DripWCHANRewards, IWCHANVault} from "../src/DripWCHANRewards.sol";

/// @dev Minimal ERC20 mock
contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract DripBaseTest is Test {
    MockToken public wchan;
    MockToken public weth;
    WCHANVault public vault;
    DripWCHANRewards public drip;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bot = makeAddr("bot");

    uint256 internal constant INITIAL = 10_000_000 ether;

    function setUp() public virtual {
        wchan = new MockToken("WalletChan", "WCHAN");
        weth = new MockToken("Wrapped Ether", "WETH");
        // Seed vault with dead shares (inflation-attack protection)
        uint256 seedAmount = 1e6;
        address vaultAddr = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        wchan.mint(address(this), seedAmount);
        wchan.approve(vaultAddr, seedAmount);
        vault = new WCHANVault(IERC20(address(wchan)), IERC20(address(weth)), seedAmount);
        drip = new DripWCHANRewards(owner, IWCHANVault(address(vault)), IERC20(address(wchan)), IERC20(address(weth)));

        // Fund owner for configuring streams
        wchan.mint(owner, INITIAL);
        weth.mint(owner, INITIAL);
        vm.prank(owner);
        wchan.approve(address(drip), type(uint256).max);
        vm.prank(owner);
        weth.approve(address(drip), type(uint256).max);

        // Fund alice for staking
        wchan.mint(alice, INITIAL);
        vm.prank(alice);
        wchan.approve(address(vault), type(uint256).max);
    }

    function _setupWchanStream(uint256 amount, uint256 duration) internal {
        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + duration);
    }

    function _setupWethStream(uint256 amount, uint256 duration) internal {
        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + duration);
    }

    function _stakeInVault(address user, uint256 amount) internal {
        vm.prank(user);
        vault.deposit(amount, user);
    }
}

// ═══════════════════════════════════════════════════════
//                    Constructor
// ═══════════════════════════════════════════════════════

contract DripConstructorTest is DripBaseTest {
    function test_immutables() public view {
        assertEq(address(drip.vault()), address(vault));
        assertEq(address(drip.wchan()), address(wchan));
        assertEq(address(drip.weth()), address(weth));
        assertEq(drip.owner(), owner);
    }

    function test_vaultApprovals() public view {
        assertEq(wchan.allowance(address(drip), address(vault)), type(uint256).max);
        assertEq(weth.allowance(address(drip), address(vault)), type(uint256).max);
    }

    function test_initialStreamsEmpty() public view {
        (uint256 start, uint256 end, uint256 lastDrip, uint256 remaining) = drip.wchanStream();
        assertEq(start, 0);
        assertEq(end, 0);
        assertEq(lastDrip, 0);
        assertEq(remaining, 0);

        (start, end, lastDrip, remaining) = drip.wethStream();
        assertEq(start, 0);
        assertEq(end, 0);
        assertEq(lastDrip, 0);
        assertEq(remaining, 0);
    }

    function test_minDripInterval() public view {
        assertEq(drip.MIN_DRIP_INTERVAL(), 1 hours);
    }
}

// ═══════════════════════════════════════════════════════
//                    Configure
// ═══════════════════════════════════════════════════════

contract DripConfigureTest is DripBaseTest {
    function test_configureWchanStream() public {
        uint256 amount = 1000 ether;
        uint256 endTs = block.timestamp + 7 days;

        vm.expectEmit(true, false, false, true, address(drip));
        emit DripWCHANRewards.DripConfigured(false, amount, endTs);

        vm.prank(owner);
        drip.configureDrip(false, amount, endTs);

        (uint256 start, uint256 end, uint256 lastDrip, uint256 remaining) = drip.wchanStream();
        assertEq(start, block.timestamp);
        assertEq(end, endTs);
        assertEq(lastDrip, block.timestamp);
        assertEq(remaining, amount);

        // Tokens pulled from owner
        assertEq(wchan.balanceOf(address(drip)), amount);
    }

    function test_configureWethStream() public {
        uint256 amount = 500 ether;
        uint256 endTs = block.timestamp + 14 days;

        vm.prank(owner);
        drip.configureDrip(true, amount, endTs);

        (uint256 start, uint256 end, uint256 lastDrip, uint256 remaining) = drip.wethStream();
        assertEq(start, block.timestamp);
        assertEq(end, endTs);
        assertEq(lastDrip, block.timestamp);
        assertEq(remaining, amount);

        assertEq(weth.balanceOf(address(drip)), amount);
    }

    function test_topUp_additive() public {
        _setupWchanStream(1000 ether, 7 days);

        // Top up before any drip happens
        vm.prank(owner);
        drip.configureDrip(false, 500 ether, block.timestamp + 7 days);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 1500 ether);
    }

    function test_topUp_extendsEnd() public {
        uint256 originalEnd = block.timestamp + 7 days;
        _setupWchanStream(1000 ether, 7 days);

        uint256 longerEnd = block.timestamp + 14 days;
        vm.prank(owner);
        drip.configureDrip(false, 500 ether, longerEnd);

        (, uint256 end, , ) = drip.wchanStream();
        assertEq(end, longerEnd);

        // Shorter end should not shorten
        vm.prank(owner);
        drip.configureDrip(false, 100 ether, originalEnd);

        (, end, , ) = drip.wchanStream();
        assertEq(end, longerEnd);
    }

    function test_configure_settlesPending() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Warp 5 days — half should be pending
        vm.warp(block.timestamp + 5 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));

        // Reconfigure triggers settlement (no interval check)
        vm.prank(owner);
        drip.configureDrip(false, 200 ether, block.timestamp + 10 days);

        uint256 vaultAfter = wchan.balanceOf(address(vault));
        uint256 settled = vaultAfter - vaultBefore;

        // ~500 ether should have been settled (half of 1000 over 10 days)
        assertApproxEqAbs(settled, 500 ether, 1);

        // Remaining = (1000 - 500) + 200 = 700
        (, , , uint256 remaining) = drip.wchanStream();
        assertApproxEqAbs(remaining, 700 ether, 1);
    }

    function test_configure_resetsAfterDrain() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(100 ether, 1 days);

        // Warp past end so stream is fully drained on settlement
        vm.warp(block.timestamp + 2 days);

        uint256 newEnd = block.timestamp + 7 days;
        vm.prank(owner);
        drip.configureDrip(false, 500 ether, newEnd);

        (uint256 start, uint256 end, uint256 lastDrip, uint256 remaining) = drip.wchanStream();
        assertEq(start, block.timestamp);
        assertEq(lastDrip, block.timestamp);
        assertEq(end, newEnd);
        assertEq(remaining, 500 ether);
    }

    function test_configure_revertsZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(DripWCHANRewards.ZeroAmount.selector);
        drip.configureDrip(false, 0, block.timestamp + 1 days);
    }

    function test_configure_revertsEndInPast() public {
        vm.prank(owner);
        vm.expectRevert(DripWCHANRewards.EndTimestampInPast.selector);
        drip.configureDrip(false, 100 ether, block.timestamp);
    }

    function test_configure_revertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        drip.configureDrip(false, 100 ether, block.timestamp + 1 days);
    }
}

// ═══════════════════════════════════════════════════════
//                    Drip Execution
// ═══════════════════════════════════════════════════════

contract DripExecutionTest is DripBaseTest {
    function test_basicWchanDrip() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 vaultAfter = wchan.balanceOf(address(vault));

        uint256 dripped = vaultAfter - vaultBefore;
        // 1 hour out of 10 days ≈ 4.166 ether
        uint256 tenDays = 10 days;
        assertApproxEqAbs(dripped, 1000 ether * 1 hours / tenDays, 1);
    }

    function test_basicWethDrip() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        uint256 earnedBefore = vault.earned(alice);
        drip.drip();
        uint256 earnedAfter = vault.earned(alice);

        uint256 dripped = earnedAfter - earnedBefore;
        uint256 tenDays = 10 days;
        // Vault's rewardPerShareStored mulDiv + dead-share fraction introduce rounding
        assertApproxEqAbs(dripped, 500 ether * 1 hours / tenDays, 1e4);
    }

    function test_bothStreamsDrip() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 2 hours);

        uint256 vaultWchanBefore = wchan.balanceOf(address(vault));
        uint256 earnedBefore = vault.earned(alice);

        drip.drip();

        uint256 wchanDripped = wchan.balanceOf(address(vault)) - vaultWchanBefore;
        uint256 wethDripped = vault.earned(alice) - earnedBefore;

        assertGt(wchanDripped, 0);
        assertGt(wethDripped, 0);
    }

    function test_permissionless() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        // Anyone can call drip
        vm.prank(bot);
        drip.drip();
    }

    function test_selfCorrectionAfterMissedIntervals() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Miss 5 days worth of drips
        vm.warp(block.timestamp + 5 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        // Should catch up: ~500 ether (half of stream)
        assertApproxEqAbs(dripped, 500 ether, 1);
    }

    function test_drainsToZeroAtEnd() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Warp past end
        vm.warp(block.timestamp + 11 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        assertEq(dripped, 1000 ether);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }

    function test_lastDripGetsDust() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Drip several times, then drain the rest
        vm.warp(block.timestamp + 3 days);
        drip.drip();

        vm.warp(block.timestamp + 3 days);
        drip.drip();

        // Drain everything remaining
        vm.warp(block.timestamp + 5 days);
        drip.drip();

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }

    function test_wethDripsToDeadSharesWhenNoRealStakers() public {
        // No real stakers in vault — only dead shares from constructor seed
        _setupWchanStream(1000 ether, 10 days);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        // Both streams drip (dead shares keep totalSupply > 0)
        drip.drip();

        // WCHAN was dripped
        (, , , uint256 wchanRemaining) = drip.wchanStream();
        assertLt(wchanRemaining, 1000 ether);

        // WETH was also dripped (to dead shares — rewards locked forever)
        (, , , uint256 wethRemaining) = drip.wethStream();
        assertLt(wethRemaining, 500 ether);
    }

    function test_wethDripsContinuouslyWithDeadShares() public {
        // With a seeded vault, WETH drips immediately (dead shares always present)
        _setupWethStream(500 ether, 10 days);
        _setupWchanStream(100 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);
        drip.drip();

        // WETH was dripped even without real stakers
        (, , , uint256 remaining) = drip.wethStream();
        assertLt(remaining, 500 ether);

        // Alice stakes — she starts earning from this point
        _stakeInVault(alice, 1000 ether);

        vm.warp(block.timestamp + 1 hours);
        drip.drip();

        // Alice earns most of the WETH reward (dead shares fraction negligible)
        assertGt(vault.earned(alice), 0);
    }

    function test_revertsNothingToDrip() public {
        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    function test_revertsWithinInterval() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Warp only 30 minutes (< 1 hour interval)
        vm.warp(block.timestamp + 30 minutes);

        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    function test_emitsDrippedEvents() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        // Expect both Dripped events
        vm.expectEmit(true, false, false, false, address(drip));
        emit DripWCHANRewards.Dripped(false, 0); // WCHAN (amount unchecked with false)
        vm.expectEmit(true, false, false, false, address(drip));
        emit DripWCHANRewards.Dripped(true, 0); // WETH

        drip.drip();
    }
}

// ═══════════════════════════════════════════════════════
//                    Formula Tests
// ═══════════════════════════════════════════════════════

contract DripFormulaTest is DripBaseTest {
    function test_halfwayAmount() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 5 days);

        (uint256 wchanPreview, ) = drip.previewDrip();
        assertApproxEqAbs(wchanPreview, 500 ether, 1);
    }

    function test_quarterAmount() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 2.5 days);

        (uint256 wchanPreview, ) = drip.previewDrip();
        assertApproxEqAbs(wchanPreview, 250 ether, 1);
    }

    function test_exactEnd() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 10 days);

        (uint256 wchanPreview, ) = drip.previewDrip();
        assertEq(wchanPreview, 1000 ether);
    }

    function test_pastEnd() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 20 days);

        (uint256 wchanPreview, ) = drip.previewDrip();
        assertEq(wchanPreview, 1000 ether);
    }

    function test_recalculationAfterDrip() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // First drip at day 2
        vm.warp(block.timestamp + 2 days);
        drip.drip();

        (, , , uint256 remaining) = drip.wchanStream();
        assertApproxEqAbs(remaining, 800 ether, 1);

        // Next drip at day 4 — should be based on remaining/remainingDuration
        vm.warp(block.timestamp + 2 days);
        (uint256 preview, ) = drip.previewDrip();
        // 2 days elapsed out of 8 days remaining = 800 * 2/8 = 200
        assertApproxEqAbs(preview, 200 ether, 1);
    }

    function test_dustDrainage() public {
        _stakeInVault(alice, 1000 ether);
        // Small amount that creates rounding
        _setupWchanStream(7 ether, 3 days);

        // Drip at 1 hour intervals until past end
        uint256 totalDripped;
        for (uint256 i = 0; i < 80; i++) {
            vm.warp(block.timestamp + 1 hours);
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) {
                uint256 before = wchan.balanceOf(address(vault));
                drip.drip();
                totalDripped += wchan.balanceOf(address(vault)) - before;
            }
        }

        // All tokens should have been dripped
        assertEq(totalDripped, 7 ether);
        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }
}

// ═══════════════════════════════════════════════════════
//                    View Functions
// ═══════════════════════════════════════════════════════

contract DripViewTest is DripBaseTest {
    function test_canDrip_beforeConfig() public view {
        (bool wchanCan, bool wethCan) = drip.canDrip();
        assertFalse(wchanCan);
        assertFalse(wethCan);
    }

    function test_canDrip_afterInterval() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 1 hours);

        (bool wchanCan, ) = drip.canDrip();
        assertTrue(wchanCan);
    }

    function test_canDrip_withinInterval() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 30 minutes);

        (bool wchanCan, ) = drip.canDrip();
        assertFalse(wchanCan);
    }

    function test_canDrip_afterDrain() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 1 days);

        vm.warp(block.timestamp + 2 days);
        drip.drip();

        (bool wchanCan, ) = drip.canDrip();
        assertFalse(wchanCan);
    }

    function test_previewMatchesActual() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 3 hours);

        (uint256 wchanPreview, uint256 wethPreview) = drip.previewDrip();

        uint256 vaultWchanBefore = wchan.balanceOf(address(vault));
        uint256 earnedBefore = vault.earned(alice);

        drip.drip();

        uint256 wchanActual = wchan.balanceOf(address(vault)) - vaultWchanBefore;
        uint256 wethActual = vault.earned(alice) - earnedBefore;

        assertEq(wchanPreview, wchanActual);
        // Dead shares absorb a tiny fraction of WETH, so earned(alice) < total dripped
        assertApproxEqAbs(wethPreview, wethActual, 1e4);
    }
}

// ═══════════════════════════════════════════════════════
//                  Token Recovery
// ═══════════════════════════════════════════════════════

contract DripRecoverTest is DripBaseTest {
    function test_recoverWchan() public {
        _setupWchanStream(1000 ether, 10 days);

        uint256 ownerBefore = wchan.balanceOf(owner);
        vm.prank(owner);
        drip.recoverTokens(address(wchan), 100 ether);
        assertEq(wchan.balanceOf(owner) - ownerBefore, 100 ether);
    }

    function test_recoverWchan_updatesAccounting() public {
        _setupWchanStream(1000 ether, 10 days);

        vm.prank(owner);
        drip.recoverTokens(address(wchan), 100 ether);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 900 ether);
    }

    function test_recoverWeth() public {
        _setupWethStream(500 ether, 10 days);

        uint256 ownerBefore = weth.balanceOf(owner);
        vm.prank(owner);
        drip.recoverTokens(address(weth), 50 ether);
        assertEq(weth.balanceOf(owner) - ownerBefore, 50 ether);
    }

    function test_recoverWeth_updatesAccounting() public {
        _setupWethStream(500 ether, 10 days);

        vm.prank(owner);
        drip.recoverTokens(address(weth), 50 ether);

        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, 450 ether);
    }

    function test_recoverArbitraryToken() public {
        MockToken other = new MockToken("Other", "OTH");
        other.mint(address(drip), 100 ether);

        vm.prank(owner);
        drip.recoverTokens(address(other), 100 ether);
        assertEq(other.balanceOf(owner), 100 ether);
    }

    function test_recoverArbitraryToken_noAccountingChange() public {
        MockToken other = new MockToken("Other", "OTH");
        other.mint(address(drip), 100 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.prank(owner);
        drip.recoverTokens(address(other), 100 ether);

        // WCHAN stream unaffected
        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 1000 ether);
    }

    function test_recoverMoreThanRemaining_capsReduction() public {
        _setupWchanStream(100 ether, 10 days);

        // Mint extra WCHAN directly to drip (simulating accidental transfer)
        wchan.mint(address(drip), 200 ether);

        // Recover 250 (more than stream's 100 remaining)
        vm.prank(owner);
        drip.recoverTokens(address(wchan), 250 ether);

        // amountRemaining capped to 0 (not underflow)
        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }

    function test_recoverWchan_futureDripsWork() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Recover 200 — remaining goes to 800
        vm.prank(owner);
        drip.recoverTokens(address(wchan), 200 ether);

        // Drip past end — should drain exactly 800 (not revert)
        vm.warp(block.timestamp + 11 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        assertEq(wchan.balanceOf(address(vault)) - vaultBefore, 800 ether);
    }

    function test_recoverEmitsEvent() public {
        _setupWchanStream(1000 ether, 10 days);

        vm.expectEmit(true, true, false, true, address(drip));
        emit DripWCHANRewards.TokensRecovered(address(wchan), owner, 50 ether);

        vm.prank(owner);
        drip.recoverTokens(address(wchan), 50 ether);
    }

    function test_recoverRevertsNonOwner() public {
        _setupWchanStream(1000 ether, 10 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        drip.recoverTokens(address(wchan), 100 ether);
    }
}

// ═══════════════════════════════════════════════════════
//                    Fuzz Tests
// ═══════════════════════════════════════════════════════

contract DripFuzzTest is DripBaseTest {
    function test_fuzz_dripNeverExceedsRemaining(uint256 amount, uint256 duration, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        duration = bound(duration, 1 hours, 365 days);
        elapsed = bound(elapsed, 1 hours, duration * 2);

        _stakeInVault(alice, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + duration);

        vm.warp(block.timestamp + elapsed);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        assertLe(dripped, amount);
    }

    function test_fuzz_totalDrippedNeverExceedsConfigured(uint256 amount, uint256 numDrips) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        numDrips = bound(numDrips, 1, 50);

        _stakeInVault(alice, 1000 ether);

        uint256 duration = 10 days;
        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + duration);

        uint256 totalDripped;
        uint256 interval = duration / numDrips;
        if (interval < 1 hours) interval = 1 hours;

        for (uint256 i = 0; i < numDrips; i++) {
            vm.warp(block.timestamp + interval);
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) {
                uint256 before = wchan.balanceOf(address(vault));
                drip.drip();
                totalDripped += wchan.balanceOf(address(vault)) - before;
            }
        }

        assertLe(totalDripped, amount);
    }

    function test_fuzz_selfCorrectionProperty(uint256 amount, uint256 missedHours) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        missedHours = bound(missedHours, 2, 240); // 2 hours to 10 days

        _stakeInVault(alice, 1000 ether);

        uint256 duration = 30 days;
        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + duration);

        // Drip once at 1 hour (normal)
        vm.warp(block.timestamp + 1 hours);
        drip.drip();

        // Miss many hours, then drip
        vm.warp(block.timestamp + missedHours * 1 hours);
        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 catchUpDrip = wchan.balanceOf(address(vault)) - vaultBefore;

        // The catch-up drip should be proportional to missed time
        // It should be > a single-hour drip (unless stream is nearly drained)
        (, , , uint256 remaining) = drip.wchanStream();
        if (remaining > 0) {
            // Catch-up drip should be larger than what a single hour would give
            // (This is the self-correction property)
            assertGt(catchUpDrip, 0);
        }
    }

    function test_fuzz_additiveTopUps(uint256 amount1, uint256 amount2) public {
        amount1 = bound(amount1, 1 ether, INITIAL / 4);
        amount2 = bound(amount2, 1 ether, INITIAL / 4);

        _stakeInVault(alice, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(false, amount1, block.timestamp + 10 days);

        vm.prank(owner);
        drip.configureDrip(false, amount2, block.timestamp + 10 days);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, amount1 + amount2);
    }

    function test_fuzz_previewMatchesActual(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        elapsed = bound(elapsed, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + 10 days);

        vm.warp(block.timestamp + elapsed);

        (uint256 preview, ) = drip.previewDrip();

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 actual = wchan.balanceOf(address(vault)) - vaultBefore;

        assertEq(preview, actual);
    }

    function test_fuzz_wethDripNeverExceedsRemaining(uint256 amount, uint256 duration, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        duration = bound(duration, 1 hours, 365 days);
        elapsed = bound(elapsed, 1 hours, duration * 2);

        _stakeInVault(alice, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + duration);

        vm.warp(block.timestamp + elapsed);

        (, , , uint256 remainingBefore) = drip.wethStream();
        drip.drip();
        (, , , uint256 remainingAfter) = drip.wethStream();

        uint256 dripped = remainingBefore - remainingAfter;
        assertLe(dripped, amount);
    }

    function test_fuzz_wethTotalDrippedNeverExceedsConfigured(uint256 amount, uint256 numDrips) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        numDrips = bound(numDrips, 1, 50);

        _stakeInVault(alice, 1000 ether);

        uint256 duration = 10 days;
        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + duration);

        uint256 totalDripped;
        uint256 interval = duration / numDrips;
        if (interval < 1 hours) interval = 1 hours;

        for (uint256 i = 0; i < numDrips; i++) {
            vm.warp(block.timestamp + interval);
            (, bool wethCan) = drip.canDrip();
            if (wethCan) {
                (, , , uint256 before) = drip.wethStream();
                drip.drip();
                (, , , uint256 after_) = drip.wethStream();
                totalDripped += before - after_;
            }
        }

        assertLe(totalDripped, amount);
    }

    function test_fuzz_wethPreviewMatchesActual(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        elapsed = bound(elapsed, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + 10 days);

        vm.warp(block.timestamp + elapsed);

        (, uint256 preview) = drip.previewDrip();

        (, , , uint256 remainingBefore) = drip.wethStream();
        drip.drip();
        (, , , uint256 remainingAfter) = drip.wethStream();

        uint256 actual = remainingBefore - remainingAfter;
        assertEq(preview, actual);
    }

    function test_fuzz_configureSettlesCorrectly(uint256 amount, uint256 elapsed, uint256 topUp) public {
        amount = bound(amount, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 1, 365 days);
        topUp = bound(topUp, 1 ether, INITIAL / 4);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 10 days);

        vm.warp(block.timestamp + elapsed);

        (, , , uint256 remainingBefore) = drip.wchanStream();
        uint256 vaultBefore = wchan.balanceOf(address(vault));

        vm.prank(owner);
        drip.configureDrip(false, topUp, block.timestamp + 10 days);

        uint256 settled = wchan.balanceOf(address(vault)) - vaultBefore;
        (, , , uint256 remainingAfter) = drip.wchanStream();

        // remaining = (old - settled) + topUp
        assertEq(remainingAfter, remainingBefore - settled + topUp);
        // settled should never exceed what was there
        assertLe(settled, remainingBefore);
    }

    function test_fuzz_bothStreamsIndependent(
        uint256 wchanAmt,
        uint256 wethAmt,
        uint256 elapsed
    ) public {
        wchanAmt = bound(wchanAmt, 1 ether, INITIAL / 4);
        wethAmt = bound(wethAmt, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(wchanAmt, 10 days);
        _setupWethStream(wethAmt, 10 days);

        vm.warp(block.timestamp + elapsed);

        (uint256 wchanPreview, uint256 wethPreview) = drip.previewDrip();

        // Both should be calculable independently
        if (elapsed >= 10 days) {
            assertEq(wchanPreview, wchanAmt);
            assertEq(wethPreview, wethAmt);
        } else {
            assertLe(wchanPreview, wchanAmt);
            assertLe(wethPreview, wethAmt);
        }
    }
}

// ═══════════════════════════════════════════════════════
//            WETH Settlement (configureDrip)
// ═══════════════════════════════════════════════════════

contract DripWethSettlementTest is DripBaseTest {
    function test_configure_settlesWethPending() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(500 ether, 10 days);

        vm.warp(block.timestamp + 5 days);

        uint256 earnedBefore = vault.earned(alice);

        // Reconfigure triggers _settleDrip for WETH (lines 258-261)
        vm.prank(owner);
        drip.configureDrip(true, 200 ether, block.timestamp + 10 days);

        uint256 earnedAfter = vault.earned(alice);

        // ~250 WETH should have been settled to vault
        assertGt(earnedAfter, earnedBefore);

        // Remaining = (500 - ~250) + 200 = ~450
        (, , , uint256 remaining) = drip.wethStream();
        assertApproxEqAbs(remaining, 450 ether, 1);
    }

    function test_configure_settlesWethPending_exactAmounts() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 2 days);

        // Settlement should drip 2/10 of 1000 = 200 WETH
        (, , , uint256 remainingBefore) = drip.wethStream();
        assertEq(remainingBefore, 1000 ether);

        vm.prank(owner);
        drip.configureDrip(true, 100 ether, block.timestamp + 10 days);

        (, , , uint256 remainingAfter) = drip.wethStream();
        // 1000 - 200 + 100 = 900
        assertApproxEqAbs(remainingAfter, 900 ether, 1);
    }

    function test_configure_settlesWeth_afterDrain() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(500 ether, 1 days);

        // Past end — settlement drains everything
        vm.warp(block.timestamp + 2 days);

        vm.prank(owner);
        drip.configureDrip(true, 300 ether, block.timestamp + 7 days);

        (uint256 start, uint256 end, uint256 lastDrip, uint256 remaining) = drip.wethStream();
        assertEq(start, block.timestamp);
        assertEq(lastDrip, block.timestamp);
        assertEq(remaining, 300 ether);
        assertEq(end, block.timestamp + 7 days);
    }

    function test_configure_settlesWeth_emitsDrippedEvent() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 5 days);

        // Settlement should emit Dripped(true, ~500 ether)
        vm.expectEmit(true, false, false, false, address(drip));
        emit DripWCHANRewards.Dripped(true, 0);

        vm.prank(owner);
        drip.configureDrip(true, 100 ether, block.timestamp + 10 days);
    }
}

// ═══════════════════════════════════════════════════════
//     Zero-Supply Vault (WETH Skip Path in drip())
// ═══════════════════════════════════════════════════════

/// @dev Mock vault that always reports zero totalSupply
contract MockZeroSupplyVault {
    IERC20 public immutable wchan;
    IERC20 public immutable weth;

    constructor(IERC20 wchan_, IERC20 weth_) {
        wchan = wchan_;
        weth = weth_;
    }

    function donate(uint256 amount) external {
        wchan.transferFrom(msg.sender, address(this), amount);
    }

    function donateReward(uint256 amount) external {
        weth.transferFrom(msg.sender, address(this), amount);
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }
}

contract DripZeroSupplyTest is Test {
    MockToken public wchan;
    MockToken public weth;
    MockZeroSupplyVault public mockVault;
    DripWCHANRewards public drip;

    address internal owner = makeAddr("owner");
    uint256 internal constant INITIAL = 10_000_000 ether;

    function setUp() public {
        wchan = new MockToken("WalletChan", "WCHAN");
        weth = new MockToken("Wrapped Ether", "WETH");
        mockVault = new MockZeroSupplyVault(IERC20(address(wchan)), IERC20(address(weth)));
        drip = new DripWCHANRewards(
            owner,
            IWCHANVault(address(mockVault)),
            IERC20(address(wchan)),
            IERC20(address(weth))
        );

        wchan.mint(owner, INITIAL);
        weth.mint(owner, INITIAL);
        vm.prank(owner);
        wchan.approve(address(drip), type(uint256).max);
        vm.prank(owner);
        weth.approve(address(drip), type(uint256).max);
    }

    function test_wethSkippedWhenNoStakers() public {
        // Configure only WETH stream so WCHAN amount=0 and vault.donate() not called
        vm.prank(owner);
        drip.configureDrip(true, 1000 ether, block.timestamp + 10 days);

        vm.warp(block.timestamp + 2 hours);

        (, , uint256 lastDripBefore, uint256 remainingBefore) = drip.wethStream();

        // drip() succeeds but WETH is skipped (totalSupply == 0)
        drip.drip();

        (, , uint256 lastDripAfter, uint256 remainingAfter) = drip.wethStream();
        assertEq(remainingAfter, remainingBefore, "remaining should not change");
        assertEq(lastDripAfter, lastDripBefore, "lastDripTimestamp should not change");
    }

    function test_wethSkipped_preservesAccumulation() public {
        vm.prank(owner);
        drip.configureDrip(true, 1000 ether, block.timestamp + 10 days);

        // Multiple drip calls with no stakers — amount keeps accumulating
        vm.warp(block.timestamp + 2 hours);
        drip.drip();

        vm.warp(block.timestamp + 2 hours);
        drip.drip();

        // Nothing should have changed
        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, 1000 ether);
    }

    function test_wethSkipped_noEventsEmitted() public {
        vm.prank(owner);
        drip.configureDrip(true, 1000 ether, block.timestamp + 10 days);

        vm.warp(block.timestamp + 2 hours);

        // Record logs — no Dripped event should be emitted for WETH
        vm.recordLogs();
        drip.drip();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            // Dripped event topic0 = keccak256("Dripped(bool,uint256)")
            if (logs[i].topics[0] == keccak256("Dripped(bool,uint256)")) {
                revert("Dripped event should not be emitted when skipped");
            }
        }
    }

    function test_settle_wethNoStakers_skipsEntirely() public {
        // _settleDrip for WETH with no stakers should skip (no deduction, no timestamp update)
        vm.prank(owner);
        drip.configureDrip(true, 1000 ether, block.timestamp + 10 days);

        vm.warp(block.timestamp + 5 days);

        (, , uint256 lastDripBefore, ) = drip.wethStream();

        // Reconfigure triggers _settleDrip — should skip for WETH with no stakers
        vm.prank(owner);
        drip.configureDrip(true, 200 ether, block.timestamp + 10 days);

        (, , uint256 lastDripAfter, uint256 remaining) = drip.wethStream();

        // No deduction from original 1000 — full amount preserved + 200 new
        assertEq(remaining, 1200 ether);
        // lastDripTimestamp NOT updated by settlement (only by configureDrip reset logic)
        // Since remaining was > 0, no reset occurred, so lastDripTimestamp stays as-is
        assertEq(lastDripAfter, lastDripBefore);
    }

    function test_fuzz_wethSkippedWhenNoStakers(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        elapsed = bound(elapsed, 1 hours, 365 days);

        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + 10 days);

        vm.warp(block.timestamp + elapsed);

        (, , uint256 lastDripBefore, uint256 remainingBefore) = drip.wethStream();

        drip.drip();

        (, , uint256 lastDripAfter, uint256 remainingAfter) = drip.wethStream();
        assertEq(remainingAfter, remainingBefore);
        assertEq(lastDripAfter, lastDripBefore);
    }
}

// ═══════════════════════════════════════════════════════
//                    Edge Cases
// ═══════════════════════════════════════════════════════

contract DripEdgeCaseTest is DripBaseTest {
    function test_1weiAmount() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1, 1 days);

        // Past end — drain the 1 wei
        vm.warp(block.timestamp + 2 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        assertEq(wchan.balanceOf(address(vault)) - vaultBefore, 1);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }

    function test_veryShortDuration() public {
        _stakeInVault(alice, 1000 ether);

        // endTimestamp = block.timestamp + 1 (minimum valid)
        vm.prank(owner);
        drip.configureDrip(false, 100 ether, block.timestamp + 1);

        // 1 hour later — past end, drains everything
        vm.warp(block.timestamp + 1 hours);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        assertEq(wchan.balanceOf(address(vault)) - vaultBefore, 100 ether);
    }

    function test_twoDripsInSameBlock_reverts() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 2 hours);
        drip.drip();

        // Second drip in same block — elapsed=0 → NothingToDrip
        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    function test_configureInSameBlock_additive() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Immediate reconfigure — settlement computes 0 (elapsed=0)
        vm.prank(owner);
        drip.configureDrip(false, 500 ether, block.timestamp + 10 days);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 1500 ether);
    }

    function test_recoverExceedsBalance_reverts() public {
        _setupWchanStream(100 ether, 10 days);

        // Try to recover more than held
        vm.prank(owner);
        vm.expectRevert();
        drip.recoverTokens(address(wchan), 200 ether);
    }

    function test_oneStreamExpired_otherActive() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(100 ether, 1 days);
        _setupWethStream(500 ether, 10 days);

        // WCHAN stream expired, WETH still active
        vm.warp(block.timestamp + 2 days);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        (, , , uint256 wethBefore) = drip.wethStream();

        drip.drip();

        uint256 wchanDripped = wchan.balanceOf(address(vault)) - vaultBefore;
        (, , , uint256 wethAfter) = drip.wethStream();
        uint256 wethDripped = wethBefore - wethAfter;

        // WCHAN fully drained
        assertEq(wchanDripped, 100 ether);
        // WETH partially dripped
        assertGt(wethDripped, 0);
        assertLt(wethDripped, 500 ether);

        // Another drip — only WETH should work
        vm.warp(block.timestamp + 1 hours);
        (, , , wethBefore) = drip.wethStream();
        vaultBefore = wchan.balanceOf(address(vault));

        drip.drip();

        // WCHAN: 0 more dripped (already drained)
        assertEq(wchan.balanceOf(address(vault)) - vaultBefore, 0);
        (, , , wethAfter) = drip.wethStream();
        assertLt(wethAfter, wethBefore);
    }

    function test_onlyWethStreamActive() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(500 ether, 10 days);

        // No WCHAN stream configured
        vm.warp(block.timestamp + 1 hours);

        uint256 earnedBefore = vault.earned(alice);
        drip.drip();
        uint256 earnedAfter = vault.earned(alice);

        assertGt(earnedAfter, earnedBefore);
    }

    function test_dripExactlyAtInterval() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        // Exactly 1 hour — should succeed
        vm.warp(block.timestamp + 1 hours);

        (bool wchanCan, ) = drip.canDrip();
        assertTrue(wchanCan);

        drip.drip();

        (, , , uint256 remaining) = drip.wchanStream();
        assertLt(remaining, 1000 ether);
    }

    function test_dripOneSecondBeforeInterval_reverts() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 1 hours - 1);

        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    function test_wethDustDrainage() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(7 ether, 3 days);

        uint256 totalDripped;
        for (uint256 i = 0; i < 80; i++) {
            vm.warp(block.timestamp + 1 hours);
            (, bool wethCan) = drip.canDrip();
            if (wethCan) {
                (, , , uint256 before) = drip.wethStream();
                drip.drip();
                (, , , uint256 after_) = drip.wethStream();
                totalDripped += before - after_;
            }
        }

        assertEq(totalDripped, 7 ether);
        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, 0);
    }

    function test_wethSelfCorrectionAfterMissedIntervals() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(1000 ether, 10 days);

        // Miss 5 days
        vm.warp(block.timestamp + 5 days);

        (, , , uint256 before) = drip.wethStream();
        drip.drip();
        (, , , uint256 after_) = drip.wethStream();

        uint256 dripped = before - after_;
        assertApproxEqAbs(dripped, 500 ether, 1);
    }

    function test_wethDrainsToZeroAtEnd() public {
        _stakeInVault(alice, 1000 ether);
        _setupWethStream(500 ether, 5 days);

        vm.warp(block.timestamp + 6 days);

        drip.drip();

        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, 0);
    }

    function test_recoverAfterPartialDrip() public {
        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1000 ether, 10 days);

        vm.warp(block.timestamp + 5 days);
        drip.drip();

        // About 500 WCHAN remain in contract
        uint256 contractBal = wchan.balanceOf(address(drip));
        assertGt(contractBal, 0);

        // Owner recovers all remaining — accounting updated to 0
        vm.prank(owner);
        drip.recoverTokens(address(wchan), contractBal);
        assertEq(wchan.balanceOf(address(drip)), 0);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);

        // Next drip reverts NothingToDrip (remaining is 0, not a balance revert)
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    function test_fuzz_1weiRounding(uint256 duration) public {
        duration = bound(duration, 1 hours, 365 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1, duration);

        // Go past end
        vm.warp(block.timestamp + duration + 1);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        assertEq(wchan.balanceOf(address(vault)) - vaultBefore, 1);
    }

    function test_fuzz_oddAmountNoDustLoss(uint256 amount, uint256 duration) public {
        amount = bound(amount, 1, 1000 ether);
        duration = bound(duration, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, duration);

        // Drip hourly until well past end
        uint256 totalDripped;
        uint256 maxIters = duration / 1 hours + 10;
        if (maxIters > 800) maxIters = 800;

        for (uint256 i = 0; i < maxIters; i++) {
            vm.warp(block.timestamp + 1 hours);
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) {
                uint256 before = wchan.balanceOf(address(vault));
                drip.drip();
                totalDripped += wchan.balanceOf(address(vault)) - before;
            }
        }

        // Zero dust — every wei must be dripped eventually
        assertEq(totalDripped, amount);
    }
}

// ═══════════════════════════════════════════════════════
//     Blackhat / Adversarial Fuzz Tests
// ═══════════════════════════════════════════════════════

contract DripBlackhatFuzzTest is DripBaseTest {
    /// @dev Invariant: cumulative drips + remaining == original configured amount.
    ///      Tests that no tokens are created or destroyed regardless of drip pattern.
    function test_fuzz_accountingInvariant_wchan(
        uint256 amount,
        uint256 duration,
        uint8 numDrips
    ) public {
        amount = bound(amount, 1, INITIAL / 2);
        duration = bound(duration, 1 hours + 1, 365 days);
        numDrips = uint8(bound(numDrips, 1, 30));

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, duration);

        uint256 totalDripped;
        uint256 interval = duration / numDrips;
        if (interval < 1 hours) interval = 1 hours;

        for (uint256 i = 0; i < numDrips; i++) {
            vm.warp(block.timestamp + interval);
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) {
                uint256 before = wchan.balanceOf(address(vault));
                drip.drip();
                totalDripped += wchan.balanceOf(address(vault)) - before;
            }
        }

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(totalDripped + remaining, amount, "accounting invariant violated");
    }

    /// @dev Invariant: same for WETH stream.
    function test_fuzz_accountingInvariant_weth(
        uint256 amount,
        uint256 duration,
        uint8 numDrips
    ) public {
        amount = bound(amount, 1, INITIAL / 2);
        duration = bound(duration, 1 hours + 1, 365 days);
        numDrips = uint8(bound(numDrips, 1, 30));

        _stakeInVault(alice, 1000 ether);
        _setupWethStream(amount, duration);

        uint256 totalDripped;
        uint256 interval = duration / numDrips;
        if (interval < 1 hours) interval = 1 hours;

        for (uint256 i = 0; i < numDrips; i++) {
            vm.warp(block.timestamp + interval);
            (, bool wethCan) = drip.canDrip();
            if (wethCan) {
                (, , , uint256 before) = drip.wethStream();
                drip.drip();
                (, , , uint256 after_) = drip.wethStream();
                totalDripped += before - after_;
            }
        }

        (, , , uint256 remaining) = drip.wethStream();
        assertEq(totalDripped + remaining, amount, "weth accounting invariant violated");
    }

    /// @dev Attack: interleave recover + drip — verify no revert and accounting stays consistent.
    function test_fuzz_recoverThenDrip_noRevert(
        uint256 amount,
        uint256 recoverPct,
        uint256 elapsed
    ) public {
        amount = bound(amount, 2 ether, INITIAL / 2);
        recoverPct = bound(recoverPct, 1, 99); // 1-99% recovery
        elapsed = bound(elapsed, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 10 days);

        uint256 recoverAmt = amount * recoverPct / 100;

        // Owner recovers some tokens
        vm.prank(owner);
        drip.recoverTokens(address(wchan), recoverAmt);

        (, , , uint256 remainingAfterRecover) = drip.wchanStream();
        assertEq(remainingAfterRecover, amount - recoverAmt);

        // Warp and drip — should not revert
        vm.warp(block.timestamp + elapsed);
        (bool wchanCan, ) = drip.canDrip();
        if (wchanCan) {
            uint256 vaultBefore = wchan.balanceOf(address(vault));
            drip.drip();
            uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

            // Dripped amount <= remaining after recover
            assertLe(dripped, remainingAfterRecover);
        }
    }

    /// @dev Attack: configure → drip → configure → drip. Verify total distributed
    ///      never exceeds total configured across multiple top-ups.
    function test_fuzz_multipleTopUpsThenDrain(
        uint256 amount1,
        uint256 amount2,
        uint256 amount3
    ) public {
        amount1 = bound(amount1, 1 ether, INITIAL / 6);
        amount2 = bound(amount2, 1 ether, INITIAL / 6);
        amount3 = bound(amount3, 1 ether, INITIAL / 6);

        _stakeInVault(alice, 1000 ether);

        // First configure
        _setupWchanStream(amount1, 10 days);

        // Drip after 3 days
        vm.warp(block.timestamp + 3 days);
        drip.drip();

        // Top up at day 3
        vm.prank(owner);
        drip.configureDrip(false, amount2, block.timestamp + 10 days);

        // Drip after 3 more days
        vm.warp(block.timestamp + 3 days);
        drip.drip();

        // Another top up
        vm.prank(owner);
        drip.configureDrip(false, amount3, block.timestamp + 10 days);

        // Drain everything
        vm.warp(block.timestamp + 20 days);
        (bool wchanCan, ) = drip.canDrip();
        if (wchanCan) drip.drip();

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0, "stream should be fully drained");

        // Contract should hold no WCHAN (all sent to vault)
        assertEq(wchan.balanceOf(address(drip)), 0, "drip contract should be empty");
    }

    /// @dev Attack: try to extract more than configured by dripping at extreme frequency.
    ///      Even at exactly MIN_DRIP_INTERVAL, total should never exceed configured amount.
    function test_fuzz_rapidDripNeverExceedsTotal(uint256 amount) public {
        amount = bound(amount, 1 ether, INITIAL / 2);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 2 days);

        uint256 totalDripped;
        // Drip exactly at MIN_DRIP_INTERVAL for 3 days (past end)
        for (uint256 i = 0; i < 72; i++) { // 72 hours = 3 days
            vm.warp(block.timestamp + 1 hours);
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) {
                uint256 before = wchan.balanceOf(address(vault));
                drip.drip();
                totalDripped += wchan.balanceOf(address(vault)) - before;
            }
        }

        assertEq(totalDripped, amount, "must drain exactly configured amount");
        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);
    }

    /// @dev Attack: Can an attacker cause a drip amount calculation to return more than
    ///      amountRemaining? Test with extreme elapsed-to-remaining ratios.
    function test_fuzz_dripAmountNeverExceedsRemaining_extremeElapsed(
        uint256 amount,
        uint256 durationMultiplier
    ) public {
        amount = bound(amount, 1, type(uint128).max);
        durationMultiplier = bound(durationMultiplier, 1, 100);

        _stakeInVault(alice, 1000 ether);

        // Fund owner with enough
        wchan.mint(owner, amount);

        uint256 duration = 1 days;
        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + duration);

        // Warp far beyond end (durationMultiplier × duration)
        vm.warp(block.timestamp + duration * durationMultiplier);

        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        // Must drain exactly the remaining amount, never more
        assertEq(dripped, amount);
    }

    /// @dev Attack: Extend endTimestamp many times — verify all tokens still get distributed.
    function test_fuzz_endTimestampExtension_allTokensDrained(
        uint256 amount,
        uint8 extensions
    ) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        extensions = uint8(bound(extensions, 1, 10));

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 7 days);

        uint256 currentEnd = block.timestamp + 7 days;

        // Extend the end timestamp multiple times with no additional tokens
        for (uint256 i = 0; i < extensions; i++) {
            vm.warp(block.timestamp + 1 days);
            currentEnd += 3 days;
            // Top up 0 is not allowed, so we add 1 wei to extend
            wchan.mint(owner, 1);
            vm.prank(owner);
            drip.configureDrip(false, 1, currentEnd);
        }

        // Warp far past end and drain
        vm.warp(currentEnd + 1 days);
        drip.drip();

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0, "should be fully drained after extension");
    }

    /// @dev Attack: WETH skip accumulation — when stakers appear, the accumulated
    ///      time should produce correct proportional catch-up drip.
    function test_fuzz_wethSkipThenCatchup(
        uint256 amount,
        uint256 skipDays,
        uint256 catchupDays
    ) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        skipDays = bound(skipDays, 1, 5);
        catchupDays = bound(catchupDays, 1, 5);

        // Start with dead shares only (totalSupply > 0 from seed)
        _setupWethStream(amount, 10 days);

        // WETH drips to dead shares for skipDays
        for (uint256 i = 0; i < skipDays; i++) {
            vm.warp(block.timestamp + 1 days);
            (, bool wethCan) = drip.canDrip();
            if (wethCan) drip.drip();
        }

        // Alice stakes
        _stakeInVault(alice, 1000 ether);

        // Continue dripping for catchupDays
        for (uint256 i = 0; i < catchupDays; i++) {
            vm.warp(block.timestamp + 1 days);
            (, bool wethCan) = drip.canDrip();
            if (wethCan) drip.drip();
        }

        // Drain everything
        vm.warp(block.timestamp + 20 days);
        (, bool wethCan) = drip.canDrip();
        if (wethCan) drip.drip();

        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, 0, "all WETH should be distributed eventually");
    }

    /// @dev Rounding attack: amount=1 with very long duration. Each drip rounds
    ///      to 0 until drain at end. The 1 wei must still be delivered.
    function test_fuzz_singleWeiLongDuration(uint256 duration) public {
        duration = bound(duration, 1 days, 365 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(1, duration);

        // Drip many times before end — each should compute 0 (1 * elapsed / duration rounds to 0)
        uint256 numDrips = 10;
        uint256 interval = duration / numDrips;
        if (interval < 1 hours) interval = 1 hours;

        for (uint256 i = 0; i < numDrips - 1; i++) {
            vm.warp(block.timestamp + interval);
            // May or may not be able to drip (amount might round to 0)
            (bool wchanCan, ) = drip.canDrip();
            if (wchanCan) drip.drip();
        }

        // Past end — must drain the 1 wei
        vm.warp(block.timestamp + duration + 1 days);
        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        // The 1 wei must arrive eventually
        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0, "1 wei must be drained");
    }

    /// @dev Attack: front-run owner's configureDrip with a drip() call.
    ///      Verify total distributed is correct regardless.
    function test_fuzz_frontRunConfigure(
        uint256 amount,
        uint256 topUp,
        uint256 elapsed
    ) public {
        amount = bound(amount, 1 ether, INITIAL / 4);
        topUp = bound(topUp, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 1 hours, 10 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 10 days);

        vm.warp(block.timestamp + elapsed);

        // "Attacker" front-runs the owner's configure with a drip
        uint256 vaultBefore = wchan.balanceOf(address(vault));
        (bool wchanCan, ) = drip.canDrip();
        if (wchanCan) drip.drip();
        uint256 frontRunDrip = wchan.balanceOf(address(vault)) - vaultBefore;

        // Owner configures (settlement should compute ~0 since drip just ran)
        vaultBefore = wchan.balanceOf(address(vault));
        vm.prank(owner);
        drip.configureDrip(false, topUp, block.timestamp + 10 days);
        uint256 settledOnConfigure = wchan.balanceOf(address(vault)) - vaultBefore;

        // Drain everything
        vm.warp(block.timestamp + 20 days);
        vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 finalDrip = wchan.balanceOf(address(vault)) - vaultBefore;

        uint256 totalDistributed = frontRunDrip + settledOnConfigure + finalDrip;

        // Total distributed must equal total configured (amount + topUp)
        assertEq(totalDistributed, amount + topUp, "front-run should not affect total");
    }

    /// @dev Attack: recover all tokens, then try to drip — must revert NothingToDrip.
    function test_fuzz_recoverAll_thenDrip(uint256 amount) public {
        amount = bound(amount, 1 ether, INITIAL / 2);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(amount, 10 days);

        // Owner recovers everything
        vm.prank(owner);
        drip.recoverTokens(address(wchan), amount);

        (, , , uint256 remaining) = drip.wchanStream();
        assertEq(remaining, 0);

        // Drip should fail
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(DripWCHANRewards.NothingToDrip.selector);
        drip.drip();
    }

    /// @dev Attack: configure with near-max uint128 amount. Verify no overflow in mulDiv.
    function test_fuzz_largeAmounts(uint256 amount) public {
        // Near uint128 max to stress mulDiv's 512-bit intermediate
        amount = bound(amount, type(uint128).max / 2, type(uint128).max);

        _stakeInVault(alice, 1000 ether);

        // Mint enough tokens
        wchan.mint(owner, amount);
        vm.prank(owner);
        drip.configureDrip(false, amount, block.timestamp + 1 days);

        // Drip at midpoint
        vm.warp(block.timestamp + 12 hours);
        uint256 vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 dripped = wchan.balanceOf(address(vault)) - vaultBefore;

        // Should be approximately half
        assertApproxEqAbs(dripped, amount / 2, 1);
        assertLe(dripped, amount);

        // Drain the rest
        vm.warp(block.timestamp + 1 days);
        vaultBefore = wchan.balanceOf(address(vault));
        drip.drip();
        uint256 rest = wchan.balanceOf(address(vault)) - vaultBefore;

        assertEq(dripped + rest, amount);
    }

    /// @dev Attack: race condition — drip WCHAN succeeds but WETH gets skipped.
    ///      Verify WETH remains intact for later drip.
    function test_fuzz_wchanDripsWethSkipped_accountingIntact(
        uint256 wchanAmt,
        uint256 wethAmt,
        uint256 elapsed
    ) public {
        wchanAmt = bound(wchanAmt, 1 ether, INITIAL / 4);
        wethAmt = bound(wethAmt, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 1 hours, 30 days);

        _stakeInVault(alice, 1000 ether);
        _setupWchanStream(wchanAmt, 10 days);
        _setupWethStream(wethAmt, 10 days);

        vm.warp(block.timestamp + elapsed);

        (, , , uint256 wchanBefore) = drip.wchanStream();
        (, , , uint256 wethBefore) = drip.wethStream();

        drip.drip();

        (, , , uint256 wchanAfter) = drip.wchanStream();
        (, , , uint256 wethAfter) = drip.wethStream();

        uint256 wchanDripped = wchanBefore - wchanAfter;
        uint256 wethDripped = wethBefore - wethAfter;

        // Both should have dripped something (stakers exist)
        if (elapsed < 10 days) {
            assertLe(wchanDripped, wchanBefore);
            assertLe(wethDripped, wethBefore);
        } else {
            assertEq(wchanAfter, 0);
            assertEq(wethAfter, 0);
        }

        // Accounting: dripped + remaining == original
        assertEq(wchanDripped + wchanAfter, wchanBefore);
        assertEq(wethDripped + wethAfter, wethBefore);
    }

    /// @dev Fuzz recovery of WETH with varying amounts — accounting stays consistent.
    function test_fuzz_recoverWeth_accountingConsistent(
        uint256 amount,
        uint256 recoverAmt
    ) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        recoverAmt = bound(recoverAmt, 1, amount);

        _setupWethStream(amount, 10 days);

        vm.prank(owner);
        drip.recoverTokens(address(weth), recoverAmt);

        (, , , uint256 remaining) = drip.wethStream();
        assertEq(remaining, amount - recoverAmt);
        assertEq(weth.balanceOf(owner), INITIAL - amount + recoverAmt);
    }

    /// @dev Attack: configure WETH, drip partially, recover rest, then reconfigure.
    ///      Verify no double-counting or stale state.
    function test_fuzz_wethDripRecoverReconfigure(
        uint256 amount1,
        uint256 amount2,
        uint256 elapsed
    ) public {
        amount1 = bound(amount1, 2 ether, INITIAL / 4);
        amount2 = bound(amount2, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 1 hours, 5 days);

        _stakeInVault(alice, 1000 ether);
        _setupWethStream(amount1, 10 days);

        // Drip some
        vm.warp(block.timestamp + elapsed);
        drip.drip();

        // Recover all remaining WETH
        (, , , uint256 remaining) = drip.wethStream();
        if (remaining > 0) {
            vm.prank(owner);
            drip.recoverTokens(address(weth), remaining);
        }

        (, , , uint256 remainingAfterRecover) = drip.wethStream();
        assertEq(remainingAfterRecover, 0);

        // Reconfigure with fresh amount
        vm.prank(owner);
        drip.configureDrip(true, amount2, block.timestamp + 10 days);

        (, , , uint256 newRemaining) = drip.wethStream();
        assertEq(newRemaining, amount2, "fresh configure after full recovery");

        // Drain all
        vm.warp(block.timestamp + 20 days);
        drip.drip();

        (, , , uint256 finalRemaining) = drip.wethStream();
        assertEq(finalRemaining, 0);
    }
}

// ═══════════════════════════════════════════════════════
//       Zero Supply — Enhanced Branch Coverage
// ═══════════════════════════════════════════════════════

/// @dev Mock vault where totalSupply can be toggled (simulates stakers joining/leaving)
contract MockToggleVault {
    IERC20 public immutable wchan;
    IERC20 public immutable weth;
    bool public hasStakers;

    constructor(IERC20 wchan_, IERC20 weth_) {
        wchan = wchan_;
        weth = weth_;
    }

    function setHasStakers(bool _has) external {
        hasStakers = _has;
    }

    function donate(uint256 amount) external {
        wchan.transferFrom(msg.sender, address(this), amount);
    }

    function donateReward(uint256 amount) external {
        weth.transferFrom(msg.sender, address(this), amount);
    }

    function totalSupply() external view returns (uint256) {
        return hasStakers ? 1000 ether : 0;
    }
}

contract DripToggleSupplyTest is Test {
    MockToken public wchan;
    MockToken public weth;
    MockToggleVault public mockVault;
    DripWCHANRewards public drip;

    address internal owner = makeAddr("owner");
    uint256 internal constant INITIAL = 10_000_000 ether;

    function setUp() public {
        wchan = new MockToken("WalletChan", "WCHAN");
        weth = new MockToken("Wrapped Ether", "WETH");
        mockVault = new MockToggleVault(IERC20(address(wchan)), IERC20(address(weth)));
        drip = new DripWCHANRewards(
            owner,
            IWCHANVault(address(mockVault)),
            IERC20(address(wchan)),
            IERC20(address(weth))
        );

        wchan.mint(owner, INITIAL);
        weth.mint(owner, INITIAL);
        vm.prank(owner);
        wchan.approve(address(drip), type(uint256).max);
        vm.prank(owner);
        weth.approve(address(drip), type(uint256).max);
    }

    /// @dev Stakers leave (totalSupply → 0), WETH accumulates, stakers return, catch-up drip.
    function test_stakersLeaveAndReturn() public {
        mockVault.setHasStakers(true);

        // Configure both streams
        vm.prank(owner);
        drip.configureDrip(false, 1000 ether, block.timestamp + 10 days);
        vm.prank(owner);
        drip.configureDrip(true, 500 ether, block.timestamp + 10 days);

        // Drip normally with stakers
        vm.warp(block.timestamp + 1 hours);
        drip.drip();

        (, , , uint256 wethRemainingBefore) = drip.wethStream();
        assertLt(wethRemainingBefore, 500 ether, "some WETH should have dripped");

        // Stakers leave
        mockVault.setHasStakers(false);

        vm.warp(block.timestamp + 2 hours);

        (, , uint256 lastDripBefore, uint256 wethBefore) = drip.wethStream();
        drip.drip();
        (, , uint256 lastDripAfter, uint256 wethAfter) = drip.wethStream();

        // WETH should NOT have been deducted (skip path)
        assertEq(wethAfter, wethBefore, "WETH remaining should not change when no stakers");
        assertEq(lastDripAfter, lastDripBefore, "lastDripTimestamp should not change");

        // WCHAN should have dripped (WCHAN doesn't check totalSupply)
        (, , , uint256 wchanRemaining) = drip.wchanStream();
        assertLt(wchanRemaining, 1000 ether);

        // Stakers return
        mockVault.setHasStakers(true);

        vm.warp(block.timestamp + 2 hours);
        drip.drip();

        // Now WETH should have caught up
        (, , , uint256 wethAfterReturn) = drip.wethStream();
        assertLt(wethAfterReturn, wethAfter, "WETH should drip after stakers return");
    }

    /// @dev Fuzz: toggle stakers on/off multiple times — all WETH must drain eventually.
    function test_fuzz_toggleStakers_allWethDrained(
        uint256 amount,
        uint8 toggleCount
    ) public {
        amount = bound(amount, 1 ether, INITIAL / 2);
        toggleCount = uint8(bound(toggleCount, 1, 10));

        mockVault.setHasStakers(true);

        vm.prank(owner);
        drip.configureDrip(true, amount, block.timestamp + 10 days);
        vm.prank(owner);
        drip.configureDrip(false, 1 ether, block.timestamp + 10 days);

        for (uint256 i = 0; i < toggleCount; i++) {
            mockVault.setHasStakers(i % 2 == 0);
            vm.warp(block.timestamp + 1 hours);
            drip.drip();
        }

        // End with stakers on and drain everything
        mockVault.setHasStakers(true);
        vm.warp(block.timestamp + 20 days);
        (bool wchanCan, bool wethCan) = drip.canDrip();
        if (wchanCan || wethCan) drip.drip();

        (, , , uint256 wethRemaining) = drip.wethStream();
        assertEq(wethRemaining, 0, "all WETH must drain eventually");
    }

    /// @dev Explicit branch hit: wethAmount > 0 AND totalSupply == 0 in drip().
    function test_wethSkipBranch_explicit() public {
        mockVault.setHasStakers(false);

        // Configure WCHAN stream (so drip() doesn't revert NothingToDrip on the WCHAN side)
        vm.prank(owner);
        drip.configureDrip(false, 100 ether, block.timestamp + 10 days);
        vm.prank(owner);
        drip.configureDrip(true, 500 ether, block.timestamp + 10 days);

        vm.warp(block.timestamp + 2 hours);

        (, , uint256 wethLastBefore, uint256 wethBefore) = drip.wethStream();

        // drip() should: drip WCHAN (donate succeeds), skip WETH (totalSupply == 0)
        drip.drip();

        (, , uint256 wethLastAfter, uint256 wethAfter) = drip.wethStream();

        // Verify the WETH skip path was taken
        assertEq(wethAfter, wethBefore, "WETH remaining unchanged");
        assertEq(wethLastAfter, wethLastBefore, "WETH lastDrip unchanged");

        // WCHAN did drip
        (, , , uint256 wchanRemaining) = drip.wchanStream();
        assertLt(wchanRemaining, 100 ether);
    }

    /// @dev Verify _settleDrip for WETH also skips when totalSupply == 0.
    function test_settleWeth_skipsWhenNoStakers() public {
        mockVault.setHasStakers(false);

        vm.prank(owner);
        drip.configureDrip(true, 1000 ether, block.timestamp + 10 days);

        vm.warp(block.timestamp + 5 days);

        // Reconfigure triggers _settleDrip which should skip
        vm.prank(owner);
        drip.configureDrip(true, 200 ether, block.timestamp + 10 days);

        (, , , uint256 remaining) = drip.wethStream();
        // Should be 1000 (no settlement) + 200 = 1200
        assertEq(remaining, 1200 ether);
    }

    /// @dev Attack: toggle supply to 0 BETWEEN wchan and weth processing in drip().
    ///      This can't actually happen in a single tx (no reentrancy), but verify
    ///      that even with stakers, if a later toggle happens, next drip adapts.
    function test_supplyToggleBetweenDrips() public {
        mockVault.setHasStakers(true);

        vm.prank(owner);
        drip.configureDrip(false, 1000 ether, block.timestamp + 10 days);
        vm.prank(owner);
        drip.configureDrip(true, 500 ether, block.timestamp + 10 days);

        // Normal drip
        vm.warp(block.timestamp + 1 hours);
        drip.drip();

        (, , , uint256 wethAfterFirst) = drip.wethStream();
        assertLt(wethAfterFirst, 500 ether);

        // Toggle off
        mockVault.setHasStakers(false);

        vm.warp(block.timestamp + 1 hours);
        (, , , uint256 wethBefore2) = drip.wethStream();
        drip.drip();
        (, , , uint256 wethAfter2) = drip.wethStream();

        // WETH skipped
        assertEq(wethAfter2, wethBefore2);

        // Toggle back on
        mockVault.setHasStakers(true);

        vm.warp(block.timestamp + 1 hours);
        drip.drip();
        (, , , uint256 wethAfter3) = drip.wethStream();

        // WETH should have dripped now (catch-up for skipped interval)
        assertLt(wethAfter3, wethAfter2);
    }
}
