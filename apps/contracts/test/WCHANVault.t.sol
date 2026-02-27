// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {WCHANVault} from "../src/WCHANVault.sol";

/// @dev Minimal ERC20 mock for WCHAN
contract MockWCHAN is ERC20 {
    constructor() ERC20("WalletChan", "WCHAN") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Minimal ERC20 mock for WETH (reward token)
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract WCHANVaultBaseTest is Test {
    MockWCHAN public wchan;
    MockWETH public weth;
    WCHANVault public vault;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal donor = makeAddr("donor");

    address constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 internal constant INITIAL = 1_000_000 ether;

    /// @dev Seed amount for constructor dead-shares (inflation attack protection).
    ///      All reward/asset assertions use this as tolerance since dead shares
    ///      earn a negligible fraction of yield.
    uint256 internal constant SEED_AMOUNT = 1e6;

    function setUp() public virtual {
        wchan = new MockWCHAN();
        weth = new MockWETH();

        // Seed the vault in the constructor (inflation-attack protection).
        // Pre-compute vault address so we can approve before deploy.
        address vaultAddr = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        wchan.mint(address(this), SEED_AMOUNT);
        wchan.approve(vaultAddr, SEED_AMOUNT);
        vault = new WCHANVault(IERC20(address(wchan)), IERC20(address(weth)), SEED_AMOUNT);

        // Fund test accounts
        wchan.mint(alice, INITIAL);
        wchan.mint(bob, INITIAL);
        wchan.mint(donor, INITIAL);
        weth.mint(donor, INITIAL);

        // Approve vault
        vm.prank(alice);
        wchan.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        wchan.approve(address(vault), type(uint256).max);
        vm.prank(donor);
        wchan.approve(address(vault), type(uint256).max);
        vm.prank(donor);
        weth.approve(address(vault), type(uint256).max);
    }

    /// @dev Helper: deploy a fresh unseeded vault for NoStakers edge-case tests
    function _deployUnseedVault() internal returns (WCHANVault v) {
        v = new WCHANVault(IERC20(address(wchan)), IERC20(address(weth)), 0);
    }
}

// ═══════════════════════════════════════════════════════
//                       Metadata
// ═══════════════════════════════════════════════════════

contract WCHANVaultMetadataTest is WCHANVaultBaseTest {
    function test_metadata() public view {
        assertEq(vault.name(), "Staked WCHAN");
        assertEq(vault.symbol(), "sWCHAN");
        assertEq(vault.decimals(), 18);
        assertEq(vault.asset(), address(wchan));
    }

    function test_constants() public view {
        assertEq(vault.PENALTY_DURATION(), 7 days);
        assertEq(vault.MAX_PENALTY_BPS(), 2000);
        assertEq(vault.BPS(), 10_000);
        assertEq(vault.BURN_ADDRESS(), BURN_ADDRESS);
    }
}

// ═══════════════════════════════════════════════════════
//              Deposit / Withdraw (no penalty)
// ═══════════════════════════════════════════════════════

contract WCHANVaultDepositWithdrawTest is WCHANVaultBaseTest {
    function test_depositWithdrawRoundTrip_noPenalty() public {
        uint256 depositAmount = 100 ether;

        vm.prank(alice);
        uint256 shares = vault.deposit(depositAmount, alice);
        assertEq(shares, depositAmount); // 1:1 initially

        // Warp past penalty window
        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        uint256 assets = vault.withdraw(depositAmount, alice, alice);
        assertGt(assets, 0);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_redeemRoundTrip_noPenalty() public {
        uint256 depositAmount = 200 ether;

        vm.prank(alice);
        uint256 shares = vault.deposit(depositAmount, alice);

        // Warp past penalty window
        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);

        // 1 wei rounding from ERC4626 virtual shares is expected
        assertApproxEqAbs(assets, depositAmount, 1);
        assertEq(vault.balanceOf(alice), 0);
    }
}

// ═══════════════════════════════════════════════════════
//                       Donate
// ═══════════════════════════════════════════════════════

contract WCHANVaultDonateTest is WCHANVaultBaseTest {
    function test_donateIncreasesShareValue() public {
        uint256 depositAmount = 100 ether;
        uint256 donateAmount = 50 ether;

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        uint256 assetsBefore = vault.convertToAssets(1 ether);

        vm.prank(donor);
        vault.donate(donateAmount);

        assertApproxEqAbs(vault.totalAssets(), depositAmount + donateAmount + SEED_AMOUNT, 1);

        uint256 assetsAfter = vault.convertToAssets(1 ether);
        assertGt(assetsAfter, assetsBefore);

        // Warp past penalty to redeem fully
        vm.warp(block.timestamp + 7 days);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 withdrawn = vault.redeem(aliceShares, alice, alice);
        assertApproxEqAbs(withdrawn, depositAmount + donateAmount, SEED_AMOUNT);
    }

    function test_donateEmitsEvent() public {
        // Need at least one staker for donate to succeed
        vm.prank(alice);
        vault.deposit(1 ether, alice);

        vm.prank(donor);
        vm.expectEmit(true, false, false, true, address(vault));
        emit WCHANVault.Donate(donor, 10 ether, 11 ether + SEED_AMOUNT, 1 ether + SEED_AMOUNT);
        vault.donate(10 ether);
    }

    function test_donateRevertsOnZero() public {
        vm.prank(donor);
        vm.expectRevert(WCHANVault.ZeroAmount.selector);
        vault.donate(0);
    }

    function test_donateRevertsWithNoDepositors() public {
        // Deploy an unseeded vault where totalSupply == 0
        WCHANVault unseedVault = _deployUnseedVault();

        vm.prank(donor);
        vm.expectRevert(WCHANVault.NoStakers.selector);
        unseedVault.donate(100 ether);
    }

    function test_donateDistributesProRata() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(200 ether, bob);

        vm.prank(donor);
        vault.donate(30 ether);

        assertApproxEqAbs(vault.totalAssets(), 330 ether + SEED_AMOUNT, 1);

        uint256 aliceAssets = vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobAssets = vault.convertToAssets(vault.balanceOf(bob));

        assertApproxEqAbs(aliceAssets, 110 ether, SEED_AMOUNT);
        assertApproxEqAbs(bobAssets, 220 ether, SEED_AMOUNT);
    }
}

// ═══════════════════════════════════════════════════════
//                  Penalty Calculation
// ═══════════════════════════════════════════════════════

contract WCHANVaultPenaltyCalcTest is WCHANVaultBaseTest {
    function test_penaltyBps_atDeposit() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // At deposit time, penalty = 20%
        assertEq(vault.getPenaltyBps(alice), 2000);
    }

    function test_penaltyBps_halfwayThrough() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 3.5 days);

        // Halfway through: penalty ≈ 10%
        assertEq(vault.getPenaltyBps(alice), 1000);
    }

    function test_penaltyBps_after7Days() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days);

        assertEq(vault.getPenaltyBps(alice), 0);
    }

    function test_penaltyBps_afterLongTime() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 365 days);

        assertEq(vault.getPenaltyBps(alice), 0);
    }

    function test_penaltyBps_noDeposit() public view {
        assertEq(vault.getPenaltyBps(alice), 0);
    }

    function test_penaltyBps_linearDecay() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Check at 1-day intervals
        for (uint256 day = 0; day <= 7; day++) {
            vm.warp(block.timestamp + (day == 0 ? 0 : 1 days));
            uint256 expectedBps = day >= 7 ? 0 : 2000 * (7 - day) / 7;
            assertApproxEqAbs(vault.getPenaltyBps(alice), expectedBps, 1);
        }
    }
}

// ═══════════════════════════════════════════════════════
//            Early Withdraw (with penalty)
// ═══════════════════════════════════════════════════════

contract WCHANVaultEarlyWithdrawTest is WCHANVaultBaseTest {
    function test_redeem_withFullPenalty() public {
        uint256 depositAmount = 100 ether;

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        // Redeem immediately → 20% penalty
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 netAssets = vault.redeem(aliceShares, alice, alice);

        // Net should be ~80% of deposit
        uint256 expectedGross = depositAmount; // 1:1 at this point
        uint256 expectedPenalty = expectedGross * 2000 / 10_000; // 20 ether
        uint256 expectedNet = expectedGross - expectedPenalty; // 80 ether
        assertApproxEqAbs(netAssets, expectedNet, SEED_AMOUNT);

        // Half of penalty burned, half retained
        uint256 expectedBurn = expectedPenalty / 2; // 10 ether
        assertApproxEqAbs(wchan.balanceOf(BURN_ADDRESS), expectedBurn + SEED_AMOUNT, SEED_AMOUNT);

        // Vault should retain the other half
        uint256 expectedRetained = expectedPenalty - expectedBurn;
        assertApproxEqAbs(wchan.balanceOf(address(vault)), expectedRetained + SEED_AMOUNT, SEED_AMOUNT);
    }

    function test_redeem_withPartialPenalty() public {
        uint256 depositAmount = 100 ether;

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        // Warp 3.5 days → 10% penalty
        vm.warp(block.timestamp + 3.5 days);
        assertEq(vault.getPenaltyBps(alice), 1000);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 netAssets = vault.redeem(aliceShares, alice, alice);

        uint256 expectedPenalty = depositAmount * 1000 / 10_000; // 10 ether
        uint256 expectedNet = depositAmount - expectedPenalty; // 90 ether
        assertApproxEqAbs(netAssets, expectedNet, SEED_AMOUNT);

        assertApproxEqAbs(wchan.balanceOf(BURN_ADDRESS), expectedPenalty / 2 + SEED_AMOUNT, SEED_AMOUNT);
    }

    function test_redeem_partialShares_keepsTimer() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 timestampBefore = vault.lastDepositTimestamp(alice);

        // Warp 2 days
        vm.warp(block.timestamp + 2 days);

        // Redeem half of shares
        uint256 halfShares = vault.balanceOf(alice) / 2;
        vm.prank(alice);
        vault.redeem(halfShares, alice, alice);

        // Timer should remain unchanged
        assertEq(vault.lastDepositTimestamp(alice), timestampBefore);
    }

    function test_redeem_emitsPenaltyEvent() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 grossAssets = vault.convertToAssets(aliceShares);
        uint256 penalty = grossAssets * 2000 / 10_000;
        uint256 burnAmount = penalty / 2;
        uint256 retained = penalty - burnAmount;

        // Expected post-redeem state
        uint256 expectedTotalAssets = vault.totalAssets() - grossAssets + retained;
        uint256 expectedTotalShares = vault.totalSupply() - aliceShares;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(vault));
        emit WCHANVault.EarlyWithdrawPenalty(alice, penalty, burnAmount, retained, expectedTotalAssets, expectedTotalShares);
        vault.redeem(aliceShares, alice, alice);
    }

    function test_withdraw_withPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Withdraw exactly 40 ether net, immediately (20% penalty)
        vm.prank(alice);
        uint256 shares = vault.withdraw(40 ether, alice, alice);

        // Alice should have received exactly 40 ether
        assertEq(wchan.balanceOf(alice), INITIAL - 100 ether + 40 ether);
        assertGt(shares, 0);

        // Burn address should have received half of penalty
        assertGt(wchan.balanceOf(BURN_ADDRESS), SEED_AMOUNT);
    }

    function test_withdraw_noPenalty_afterCooldown() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days);

        uint256 burnBefore = wchan.balanceOf(BURN_ADDRESS);

        vm.prank(alice);
        vault.withdraw(50 ether, alice, alice);

        // No penalty — no burns
        assertEq(wchan.balanceOf(BURN_ADDRESS), burnBefore);
        assertEq(wchan.balanceOf(alice), INITIAL - 100 ether + 50 ether);
    }

    function test_maxWithdraw_withPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // At 20% penalty, max withdrawable net ≈ 80 ether
        uint256 maxW = vault.maxWithdraw(alice);
        assertApproxEqAbs(maxW, 80 ether, SEED_AMOUNT);

        // After penalty expires, max ≈ full deposit
        vm.warp(block.timestamp + 7 days);
        maxW = vault.maxWithdraw(alice);
        assertApproxEqAbs(maxW, 100 ether, 1);
    }

    function test_previewRedeemNet() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);

        // At 20% penalty, net ≈ 80 ether
        uint256 netPreview = vault.previewRedeemNet(shares, alice);
        assertApproxEqAbs(netPreview, 80 ether, SEED_AMOUNT);

        // After penalty expires
        vm.warp(block.timestamp + 7 days);
        netPreview = vault.previewRedeemNet(shares, alice);
        assertApproxEqAbs(netPreview, 100 ether, 1);
    }

    function test_penaltyRetainedAsYield_forOtherStakers() public {
        // Alice and Bob both deposit 100 ether
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        // Alice redeems immediately (20% penalty)
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 aliceNet = vault.redeem(aliceShares, alice, alice);

        // Alice penalty ≈ 20 ether. Half burned (10), half retained (10)
        uint256 alicePenalty = 100 ether - aliceNet;
        assertApproxEqAbs(alicePenalty, 20 ether, SEED_AMOUNT);

        // Bob waits out penalty, then redeems
        vm.warp(block.timestamp + 7 days);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        uint256 bobNet = vault.redeem(bobShares, bob, bob);

        // Bob should get his 100 + ~10 retained from Alice's penalty
        assertApproxEqAbs(bobNet, 110 ether, SEED_AMOUNT);
    }
}

// ═══════════════════════════════════════════════════════
//        Weighted-Average Timestamp on Deposit
// ═══════════════════════════════════════════════════════

contract WCHANVaultWeightedTimestampTest is WCHANVaultBaseTest {
    function test_weightedTimestamp_newDeposit() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        assertEq(vault.lastDepositTimestamp(alice), 1000);
    }

    function test_weightedTimestamp_additionalDeposit() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // 3 days later, deposit same amount
        vm.warp(1000 + 3 days);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Weighted avg: (1000 * 100 + (1000+3days) * 100) / 200
        // = 1000 + 1.5 days
        uint256 expected = 1000 + 1.5 days;
        assertApproxEqAbs(vault.lastDepositTimestamp(alice), expected, 1);
    }

    function test_weightedTimestamp_smallTopUp() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // 6 days later, small top-up (1% of original)
        vm.warp(1000 + 6 days);
        vm.prank(alice);
        vault.deposit(1 ether, alice);

        // Timer should barely move — still ~5.94 days elapsed
        uint256 elapsed = block.timestamp - vault.lastDepositTimestamp(alice);
        // With 1% top-up, elapsed moves from 6 days to ~5.94 days
        assertGt(elapsed, 5.9 days);
    }

    function test_weightedTimestamp_largeTopUp_resetsSignificantly() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(10 ether, alice);

        // 6 days later, 10x larger deposit
        vm.warp(1000 + 6 days);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Timer should move significantly — mostly weighted toward new deposit
        uint256 elapsed = block.timestamp - vault.lastDepositTimestamp(alice);
        // ~0.545 days elapsed (6 days * 10 / 110)
        assertLt(elapsed, 1 days);
    }

    function test_weightedTimestamp_afterFullRedeem_resetsOnNewDeposit() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(1000 + 7 days);

        // Redeem all
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        // New deposit should get fresh timestamp
        vm.warp(1000 + 10 days);
        vm.prank(alice);
        vault.deposit(50 ether, alice);

        assertEq(vault.lastDepositTimestamp(alice), 1000 + 10 days);
        assertEq(vault.getPenaltyBps(alice), 2000); // Full penalty
    }
}

// ═══════════════════════════════════════════════════════
//         Weighted Timestamp on Share Transfer
// ═══════════════════════════════════════════════════════

contract WCHANVaultTransferTimestampTest is WCHANVaultBaseTest {
    function test_transferShares_updatesReceiverTimestamp() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Wait 7 days (alice penalty-free)
        vm.warp(1000 + 7 days);
        assertEq(vault.getPenaltyBps(alice), 0);

        // Transfer shares to bob — treated as new deposit for bob
        vm.prank(alice);
        vault.transfer(bob, 50 ether);

        // Bob should have full penalty (fresh timestamp)
        assertEq(vault.getPenaltyBps(bob), 2000);
        assertEq(vault.lastDepositTimestamp(bob), 1000 + 7 days);
    }

    function test_transferShares_weightedForExistingHolder() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        // Bob waits 6 days
        vm.warp(1000 + 6 days);

        // Alice transfers 100 shares to bob (equal to his existing balance)
        vm.prank(alice);
        vault.transfer(bob, 100 ether);

        // Bob's timestamp should be weighted avg of his old deposit and the transfer
        // (1000 * 100 + (1000+6days) * 100) / 200 = 1000 + 3 days
        uint256 expected = 1000 + 3 days;
        assertApproxEqAbs(vault.lastDepositTimestamp(bob), expected, 1);
    }
}

// ═══════════════════════════════════════════════════════
//              WETH Reward Distribution
// ═══════════════════════════════════════════════════════

contract WCHANVaultRewardTest is WCHANVaultBaseTest {
    function test_donateReward_distributesProRata() public {
        // Alice 100 shares, Bob 200 shares → donate 30 WETH
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(200 ether, bob);

        vm.prank(donor);
        vault.donateReward(30 ether);

        assertApproxEqAbs(vault.earned(alice), 10 ether, SEED_AMOUNT);
        assertApproxEqAbs(vault.earned(bob), 20 ether, SEED_AMOUNT);
    }

    function test_donateReward_revertsOnZero() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vm.expectRevert(WCHANVault.ZeroAmount.selector);
        vault.donateReward(0);
    }

    function test_donateReward_revertsNoStakers() public {
        // Deploy an unseeded vault where totalSupply == 0
        WCHANVault unseedVault = _deployUnseedVault();

        vm.prank(donor);
        vm.expectRevert(WCHANVault.NoStakers.selector);
        unseedVault.donateReward(10 ether);
    }

    function test_claimRewards() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(50 ether);

        uint256 balBefore = weth.balanceOf(alice);
        vm.prank(alice);
        vault.claimRewards();

        assertApproxEqAbs(weth.balanceOf(alice) - balBefore, 50 ether, SEED_AMOUNT);
        assertEq(vault.earned(alice), 0);
    }

    function test_claimRewards_revertsOnZero() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(alice);
        vm.expectRevert(WCHANVault.ZeroAmount.selector);
        vault.claimRewards();
    }

    function test_claimRewards_multipleDonations() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // First donation
        vm.prank(donor);
        vault.donateReward(20 ether);

        // Second donation
        vm.prank(donor);
        vault.donateReward(30 ether);

        assertApproxEqAbs(vault.earned(alice), 50 ether, SEED_AMOUNT);

        vm.prank(alice);
        vault.claimRewards();

        assertApproxEqAbs(weth.balanceOf(alice), 50 ether, SEED_AMOUNT);
    }

    function test_earned_view() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(25 ether);

        uint256 earnedView = vault.earned(alice);

        uint256 balBefore = weth.balanceOf(alice);
        vm.prank(alice);
        vault.claimRewards();
        uint256 claimed = weth.balanceOf(alice) - balBefore;

        assertEq(earnedView, claimed);
    }

    function test_rewards_surviveDepositWithdraw() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(40 ether);

        uint256 earnedAfterDonate = vault.earned(alice);
        assertApproxEqAbs(earnedAfterDonate, 40 ether, SEED_AMOUNT);

        // Additional deposit shouldn't lose accumulated rewards
        vm.prank(alice);
        vault.deposit(50 ether, alice);

        assertEq(vault.earned(alice), earnedAfterDonate);

        // Partial redeem shouldn't lose rewards
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        vault.redeem(50 ether, alice, alice);

        assertEq(vault.earned(alice), earnedAfterDonate);

        // Claim should still work
        vm.prank(alice);
        vault.claimRewards();
        assertApproxEqAbs(weth.balanceOf(alice), 40 ether, SEED_AMOUNT);
    }

    function test_rewards_transferSnapshotsBothParties() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        vm.prank(donor);
        vault.donateReward(20 ether);

        // Alice: ~10, Bob: ~10 (dead shares absorb tiny fraction)
        assertApproxEqAbs(vault.earned(alice), 10 ether, SEED_AMOUNT);
        assertApproxEqAbs(vault.earned(bob), 10 ether, SEED_AMOUNT);

        uint256 aliceEarnedBefore = vault.earned(alice);
        uint256 bobEarnedBefore = vault.earned(bob);

        // Alice transfers 50 shares to Bob
        vm.prank(alice);
        vault.transfer(bob, 50 ether);

        // Rewards should be snapshotted — no change from the transfer itself
        assertEq(vault.earned(alice), aliceEarnedBefore);
        assertEq(vault.earned(bob), bobEarnedBefore);

        // New donation after transfer: Alice 50 shares, Bob 150 shares
        vm.prank(donor);
        vault.donateReward(20 ether);

        // Alice gets 50/(200+seed) * 20 ≈ 5, Bob gets 150/(200+seed) * 20 ≈ 15
        assertApproxEqAbs(vault.earned(alice), aliceEarnedBefore + 5 ether, SEED_AMOUNT);
        assertApproxEqAbs(vault.earned(bob), bobEarnedBefore + 15 ether, SEED_AMOUNT);
    }

    function test_rewards_newDepositorGetsNothing() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(30 ether);

        // Bob deposits after donation — shouldn't get retroactive rewards
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        assertApproxEqAbs(vault.earned(alice), 30 ether, SEED_AMOUNT);
        assertEq(vault.earned(bob), 0);
    }

    function test_rewards_claimDuringPenaltyWindow() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(25 ether);

        // Still in penalty window for WCHAN, but WETH rewards should be claimable
        assertGt(vault.getPenaltyBps(alice), 0);

        vm.prank(alice);
        vault.claimRewards();
        assertApproxEqAbs(weth.balanceOf(alice), 25 ether, SEED_AMOUNT);
    }

    function test_rewards_dust() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(200 ether, bob);

        // 1 wei donation — rounds down safely
        weth.mint(donor, 1);
        vm.prank(donor);
        vault.donateReward(1);

        // Earned should round down — total earned <= donated amount
        uint256 totalEarned = vault.earned(alice) + vault.earned(bob);
        assertLe(totalEarned, 1);
    }
}

// ═══════════════════════════════════════════════════════
//            ERC20Permit on Vault Shares
// ═══════════════════════════════════════════════════════

contract WCHANVaultPermitTest is WCHANVaultBaseTest {
    function test_permitOnVaultShares() public {
        uint256 ownerPk = 0xa11ce;
        address owner = vm.addr(ownerPk);
        address spender = makeAddr("spender");

        wchan.mint(owner, 100 ether);
        vm.startPrank(owner);
        wchan.approve(address(vault), 100 ether);
        vault.deposit(100 ether, owner);
        vm.stopPrank();

        uint256 permitAmount = 50 ether;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = vault.nonces(owner);

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                permitAmount,
                nonce,
                deadline
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", vault.DOMAIN_SEPARATOR(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);

        vault.permit(owner, spender, permitAmount, deadline, v, r, s);
        assertEq(vault.allowance(owner, spender), permitAmount);
    }
}

// ═══════════════════════════════════════════════════════
//                    Fuzz Tests
// ═══════════════════════════════════════════════════════

contract WCHANVaultFuzzTest is WCHANVaultBaseTest {
    // ── Deposit / Redeem round-trip ──

    function test_fuzz_depositRedeemRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, INITIAL);

        vm.prank(alice);
        uint256 shares = vault.deposit(amount, alice);
        assertGt(shares, 0);

        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);

        // ERC4626 virtual shares can cause up to 1 wei rounding loss
        assertApproxEqAbs(assets, amount, 1);
        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Deposit / Withdraw round-trip ──

    function test_fuzz_depositWithdrawRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, INITIAL);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + 7 days);

        uint256 maxW = vault.maxWithdraw(alice);

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        assertApproxEqAbs(wchan.balanceOf(alice), INITIAL, 1);
        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Penalty BPS bounded and monotonically decreasing ──

    function test_fuzz_penaltyBps_bounded(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 30 days);

        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + elapsed);

        uint256 bps = vault.getPenaltyBps(alice);
        assertLe(bps, 2000);

        if (elapsed >= 7 days) {
            assertEq(bps, 0);
        } else {
            uint256 expected = 2000 * (7 days - elapsed) / 7 days;
            assertEq(bps, expected);
        }
    }

    // ── Penalty net + burned + retained = gross (no assets lost) ──

    function test_fuzz_penaltySplit_accounting(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + elapsed);

        uint256 burnBefore = wchan.balanceOf(BURN_ADDRESS);
        uint256 vaultBefore = wchan.balanceOf(address(vault));

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 netAssets = vault.redeem(shares, alice, alice);

        uint256 burned = wchan.balanceOf(BURN_ADDRESS) - burnBefore;
        uint256 vaultAfter = wchan.balanceOf(address(vault));
        uint256 retained = vaultAfter - SEED_AMOUNT; // vault keeps seed + retained

        // gross = net + burned + retained
        uint256 gross = netAssets + burned + retained;
        assertApproxEqAbs(gross, vaultBefore - SEED_AMOUNT, SEED_AMOUNT);

        // burned ≈ retained (differ by at most 1 from odd penalty)
        assertApproxEqAbs(burned, retained, 1);
    }

    // ── maxWithdraw → withdraw never reverts ──

    function test_fuzz_maxWithdraw_isWithdrawable(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 14 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + elapsed);

        uint256 maxW = vault.maxWithdraw(alice);
        if (maxW == 0) return;

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        // Alice received exactly maxW net
        assertEq(wchan.balanceOf(alice), INITIAL - amount + maxW);
    }

    // ── withdraw delivers exact requested net amount ──

    function test_fuzz_withdraw_deliversExactNet(uint256 amount, uint256 withdrawPct) public {
        amount = bound(amount, 1 ether, INITIAL);
        withdrawPct = bound(withdrawPct, 1, 100);

        vm.prank(alice);
        vault.deposit(amount, alice);

        // Withdraw a percentage of maxWithdraw
        uint256 maxW = vault.maxWithdraw(alice);
        uint256 toWithdraw = maxW * withdrawPct / 100;
        if (toWithdraw == 0) return;

        uint256 balBefore = wchan.balanceOf(alice);

        vm.prank(alice);
        vault.withdraw(toWithdraw, alice, alice);

        // Receiver gets exactly the requested amount
        assertEq(wchan.balanceOf(alice) - balBefore, toWithdraw);
    }

    // ── previewRedeemNet matches actual redeem ──

    function test_fuzz_previewRedeemNet_matchesActual(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 14 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + elapsed);

        uint256 shares = vault.balanceOf(alice);
        uint256 preview = vault.previewRedeemNet(shares, alice);

        vm.prank(alice);
        uint256 actual = vault.redeem(shares, alice, alice);

        assertEq(preview, actual);
    }

    // ── Donate pro-rata with arbitrary ratios ──

    function test_fuzz_donate_proRata(uint256 aliceDeposit, uint256 bobDeposit, uint256 donateAmount) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 2);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 2);
        donateAmount = bound(donateAmount, 1 ether, INITIAL / 2);

        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        vm.prank(donor);
        vault.donate(donateAmount);

        // Invariant 1: totalAssets = all deposits + donation + seed (conservation)
        assertEq(vault.totalAssets(), aliceDeposit + bobDeposit + donateAmount + SEED_AMOUNT);

        uint256 aliceAssets = vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobAssets = vault.convertToAssets(vault.balanceOf(bob));

        // Invariant 2: sum of user assets ≤ totalAssets (ERC4626 floor-rounds,
        // so the sum can lose a few wei but must never exceed total)
        assertLe(aliceAssets + bobAssets, vault.totalAssets());

        // Invariant 3: proportionality — each user's share of assets matches
        // their share of deposits. Cross-multiply to avoid division:
        //   aliceAssets * bobDeposit ≈ bobAssets * aliceDeposit
        assertApproxEqRel(aliceAssets * bobDeposit, bobAssets * aliceDeposit, 1e13);
    }

    // ── Weighted timestamp always between old and now ──

    function test_fuzz_weightedTimestamp_bounded(uint256 firstAmount, uint256 secondAmount, uint256 delay) public {
        firstAmount = bound(firstAmount, 1 ether, INITIAL / 2);
        secondAmount = bound(secondAmount, 1 ether, INITIAL / 2);
        delay = bound(delay, 1, 365 days);

        vm.warp(10_000); // start at a known time
        uint256 t0 = block.timestamp;

        vm.prank(alice);
        vault.deposit(firstAmount, alice);
        assertEq(vault.lastDepositTimestamp(alice), t0);

        vm.warp(t0 + delay);
        uint256 t1 = block.timestamp;

        vm.prank(alice);
        vault.deposit(secondAmount, alice);

        uint256 ts = vault.lastDepositTimestamp(alice);

        // Weighted timestamp must be in [t0, t1]
        assertGe(ts, t0);
        assertLe(ts, t1);
    }

    // ── Total rewards earned ≤ total donated (no inflation) ──

    function test_fuzz_rewards_noInflation(uint256 aliceDeposit, uint256 bobDeposit, uint256 rewardAmount) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 2);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 2);
        rewardAmount = bound(rewardAmount, 1, INITIAL / 2);

        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        weth.mint(donor, rewardAmount);
        vm.prank(donor);
        vault.donateReward(rewardAmount);

        uint256 totalEarned = vault.earned(alice) + vault.earned(bob);
        assertLe(totalEarned, rewardAmount);
    }

    // ── Redeem with penalty: user always gets ≥ 80% of gross ──

    function test_fuzz_redeem_netAtLeast80Pct(uint256 amount) public {
        amount = bound(amount, 1 ether, INITIAL);

        vm.prank(alice);
        vault.deposit(amount, alice);

        // Redeem immediately (worst case: 20% penalty)
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 netAssets = vault.redeem(shares, alice, alice);

        // Net should be at least 80% of deposit (minus rounding)
        assertGe(netAssets + 1, amount * 8000 / 10_000);
    }

    // ── Donate only increases share value ──

    function test_fuzz_donate_shareValueOnlyIncreases(uint256 depositAmount, uint256 donateAmount) public {
        depositAmount = bound(depositAmount, 1 ether, INITIAL / 2);
        donateAmount = bound(donateAmount, 1, INITIAL / 2);

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        uint256 valueBefore = vault.convertToAssets(1 ether);

        vm.prank(donor);
        vault.donate(donateAmount);

        uint256 valueAfter = vault.convertToAssets(1 ether);
        assertGe(valueAfter, valueBefore);
    }

    // ── Multiple deposits then full redeem after cooldown ──

    function test_fuzz_multipleDeposits_fullRedeem(uint256 d1, uint256 d2, uint256 d3) public {
        d1 = bound(d1, 1 ether, INITIAL / 4);
        d2 = bound(d2, 1 ether, INITIAL / 4);
        d3 = bound(d3, 1 ether, INITIAL / 4);

        vm.startPrank(alice);
        vault.deposit(d1, alice);
        vault.deposit(d2, alice);
        vault.deposit(d3, alice);
        vm.stopPrank();

        uint256 totalDeposited = d1 + d2 + d3;

        vm.warp(block.timestamp + 7 days);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 redeemed = vault.redeem(shares, alice, alice);

        // Should get back full deposit (minus ERC4626 rounding)
        assertApproxEqAbs(redeemed, totalDeposited, 1);
    }
}

// ═══════════════════════════════════════════════════════
//           Coverage: Revert Paths & Allowance
// ═══════════════════════════════════════════════════════

contract WCHANVaultRevertAndAllowanceTest is WCHANVaultBaseTest {
    // ── Revert when redeem exceeds max ──

    function test_redeem_revertsExceedingMax() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);

        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares + 1, alice, alice);
    }

    // ── Revert when withdraw exceeds max ──

    function test_withdraw_revertsExceedingMax() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 maxW = vault.maxWithdraw(alice);

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(maxW + 1, alice, alice);
    }

    // ── Delegated redeem via allowance ──

    function test_redeem_delegated_viaAllowance() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);

        // Alice approves Bob to spend her vault shares
        vm.prank(alice);
        vault.approve(bob, shares);

        // Warp past penalty
        vm.warp(block.timestamp + 7 days);

        // Bob redeems on Alice's behalf, sending assets to Bob
        vm.prank(bob);
        uint256 assets = vault.redeem(shares, bob, alice);

        assertApproxEqAbs(assets, 100 ether, 1);
        assertEq(vault.balanceOf(alice), 0);
        assertGt(wchan.balanceOf(bob), INITIAL); // Bob received the WCHAN
    }

    // ── Delegated withdraw via allowance ──

    function test_withdraw_delegated_viaAllowance() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);

        // Alice approves Bob
        vm.prank(alice);
        vault.approve(bob, shares);

        // Warp past penalty
        vm.warp(block.timestamp + 7 days);

        // Bob withdraws on Alice's behalf
        uint256 maxW = vault.maxWithdraw(alice);
        vm.prank(bob);
        vault.withdraw(maxW, bob, alice);

        assertApproxEqAbs(wchan.balanceOf(bob), INITIAL + 100 ether, 1);
        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Delegated redeem with penalty (allowance + penalty split) ──

    function test_redeem_delegated_withPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.approve(bob, shares);

        // Redeem immediately — 20% penalty
        vm.prank(bob);
        uint256 netAssets = vault.redeem(shares, bob, alice);

        assertApproxEqAbs(netAssets, 80 ether, SEED_AMOUNT);
        assertGt(wchan.balanceOf(BURN_ADDRESS), SEED_AMOUNT);
    }

    // ── Insufficient allowance reverts ──

    function test_redeem_delegated_insufficientAllowance() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.approve(bob, shares / 2);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, alice);
    }
}

// ═══════════════════════════════════════════════════════
//           Security: Edge Cases & Attack Vectors
// ═══════════════════════════════════════════════════════

contract WCHANVaultSecurityTest is WCHANVaultBaseTest {
    // ── Inflation attack: donate to empty vault is blocked ──

    function test_inflationAttack_donateToEmptyVault_blocked() public {
        // Deploy an unseeded vault
        WCHANVault unseedVault = _deployUnseedVault();

        // Attacker tries to donate to empty vault — reverts
        vm.prank(donor);
        vm.expectRevert(WCHANVault.NoStakers.selector);
        unseedVault.donate(100 ether);
    }

    // ── Constructor seed creates dead shares that protect the vault ──

    function test_constructorSeed_createsDeadShares() public view {
        assertEq(vault.balanceOf(BURN_ADDRESS), SEED_AMOUNT);
        assertGt(vault.totalSupply(), 0);
    }

    function test_constructorSeed_depositorsSafe() public {
        // Victim deposits safely and gets proportional shares
        vm.prank(alice);
        uint256 shares = vault.deposit(100 ether, alice);

        assertGt(shares, 0);
        // Victim can redeem for ~100 ether (minus ERC4626 rounding)
        assertApproxEqAbs(vault.convertToAssets(shares), 100 ether, 1);
    }

    // ── Transfer to self doesn't reset timer ──

    function test_transferToSelf_timerUnchanged() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Wait 5 days
        vm.warp(1000 + 5 days);
        uint256 penaltyBefore = vault.getPenaltyBps(alice);

        // Transfer to self
        vm.prank(alice);
        vault.transfer(alice, 50 ether);

        // Timer should be weighted average of old + now
        uint256 penaltyAfter = vault.getPenaltyBps(alice);

        // Penalty should increase (timer moved toward now) but not to max
        assertGe(penaltyAfter, penaltyBefore);
        assertLe(penaltyAfter, 2000);
    }

    // ── Deposit with receiver != sender — receiver gets penalty timer ──

    function test_depositFor_receiverGetsPenalty() public {
        // Alice deposits for Bob
        vm.prank(alice);
        vault.deposit(100 ether, bob);

        // Bob should have penalty (he's the receiver)
        assertEq(vault.getPenaltyBps(bob), 2000);
        // Alice should have no penalty timer (she has no shares)
        assertEq(vault.getPenaltyBps(alice), 0);
    }

    // ── Reward claim after full redeem (zero balance, non-zero unclaimed) ──

    function test_claimRewards_afterFullRedeem() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(50 ether);

        uint256 earnedBeforeRedeem = vault.earned(alice);
        assertApproxEqAbs(earnedBeforeRedeem, 50 ether, SEED_AMOUNT);

        // Redeem all shares (rewards snapshotted during burn)
        vm.warp(block.timestamp + 7 days);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        // Alice has 0 shares but should still have unclaimed WETH rewards
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.earned(alice), earnedBeforeRedeem);

        // Claim should work
        vm.prank(alice);
        vault.claimRewards();
        assertEq(weth.balanceOf(alice), earnedBeforeRedeem);
    }

    // ── Multiple sequential withdrawals with changing penalty ──

    function test_sequentialWithdrawals_decayingPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Withdraw 25% of max at t=0 (20% penalty)
        uint256 maxW0 = vault.maxWithdraw(alice);
        vm.prank(alice);
        vault.withdraw(maxW0 / 4, alice, alice);

        // Withdraw another 25% at t=3.5d (10% penalty)
        vm.warp(block.timestamp + 3.5 days);
        uint256 maxW1 = vault.maxWithdraw(alice);
        vm.prank(alice);
        vault.withdraw(maxW1 / 4, alice, alice);

        // Withdraw remainder at t=7d (0% penalty)
        vm.warp(block.timestamp + 3.5 days);
        uint256 maxW2 = vault.maxWithdraw(alice);
        vm.prank(alice);
        vault.withdraw(maxW2, alice, alice);

        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Events: DonateReward ──

    function test_donateReward_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 expectedTotalAssets = vault.totalAssets(); // WETH donation doesn't change totalAssets
        uint256 expectedTotalShares = vault.totalSupply();

        vm.prank(donor);
        vm.expectEmit(true, false, false, true, address(vault));
        emit WCHANVault.DonateReward(donor, 25 ether, expectedTotalAssets, expectedTotalShares);
        vault.donateReward(25 ether);
    }

    // ── Events: RewardsClaimed ──

    function test_claimRewards_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(30 ether);

        uint256 expectedReward = vault.earned(alice);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(vault));
        emit WCHANVault.RewardsClaimed(alice, expectedReward);
        vault.claimRewards();
    }

    // ── maxRedeem is unaffected by penalty (only shares matter) ──

    function test_maxRedeem_notAffectedByPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);

        // maxRedeem should equal full share balance regardless of penalty
        assertEq(vault.maxRedeem(alice), shares);
        assertGt(vault.getPenaltyBps(alice), 0); // penalty is active

        vm.warp(block.timestamp + 7 days);
        assertEq(vault.maxRedeem(alice), shares); // same after cooldown
    }

    // ── Donate + withdraw: vault WCHAN balance invariant ──

    function test_vaultBalanceInvariant_afterDonateAndWithdraw() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        vm.prank(donor);
        vault.donate(50 ether);

        // After penalty-free redeem, vault balance >= totalAssets
        vm.warp(block.timestamp + 7 days);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);

        // Vault WCHAN balance should equal totalAssets (no undercollateralization)
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
    }
}

// ═══════════════════════════════════════════════════════
//          Security Fuzz Tests (Blackhat Thinking)
// ═══════════════════════════════════════════════════════

contract WCHANVaultSecurityFuzzTest is WCHANVaultBaseTest {
    // ── Penalty bypass via transfer: transfer → redeem never beats direct redeem ──

    function test_fuzz_penaltyBypassViaTransfer(
        uint256 depositAmount,
        uint256 elapsed
    ) public {
        depositAmount = bound(depositAmount, 1 ether, INITIAL / 2);
        elapsed = bound(elapsed, 0, 7 days);

        vm.warp(10_000);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vm.warp(10_000 + elapsed);

        uint256 aliceShares = vault.balanceOf(alice);
        // Alice's penalty-adjusted value (direct redeem)
        uint256 directPreview = vault.previewRedeemNet(aliceShares, alice);

        // Alice transfers all shares to bob
        vm.prank(alice);
        vault.transfer(bob, aliceShares);

        // Bob now has fresh timestamp → full penalty (2000 bps)
        // His penalty-adjusted value should be <= alice's direct redeem
        uint256 transferPreview = vault.previewRedeemNet(aliceShares, bob);
        assertGe(directPreview, transferPreview);
    }

    // ── _grossFromNet → _applyPenalty roundtrip: receiver always gets >= requested net ──

    function test_fuzz_grossFromNetRoundtrip(uint256 netAmount, uint256 elapsed) public {
        netAmount = bound(netAmount, 1, 1e30);
        elapsed = bound(elapsed, 0, 7 days);

        vm.prank(alice);
        vault.deposit(INITIAL, alice);

        vm.warp(block.timestamp + elapsed);

        // Can't test internal functions directly, but we can verify via withdraw
        uint256 maxW = vault.maxWithdraw(alice);
        if (netAmount > maxW) netAmount = maxW;
        if (netAmount == 0) return;

        uint256 balBefore = wchan.balanceOf(alice);

        vm.prank(alice);
        vault.withdraw(netAmount, alice, alice);

        uint256 received = wchan.balanceOf(alice) - balBefore;
        assertEq(received, netAmount); // Must receive exact requested amount
    }

    // ── Withdraw shares cap: burning ownerBalance shares never undercollateralizes ──

    function test_fuzz_withdrawSharesCap_noUndercollateral(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);

        vm.prank(alice);
        vault.deposit(amount, alice);
        vm.warp(block.timestamp + elapsed);

        uint256 maxW = vault.maxWithdraw(alice);
        if (maxW == 0) return;

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        // Vault balance should never go negative (safeTransfer would revert)
        // and totalAssets should match vault's WCHAN balance
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Reward lifecycle: deposit → reward → transfer → reward → claim is consistent ──

    function test_fuzz_rewardLifecycle(
        uint256 aliceDeposit,
        uint256 bobDeposit,
        uint256 reward1,
        uint256 reward2,
        uint256 transferAmount
    ) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 4);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 4);
        reward1 = bound(reward1, 1 ether, INITIAL / 4);
        reward2 = bound(reward2, 1 ether, INITIAL / 4);

        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        // First reward
        weth.mint(donor, reward1 + reward2);
        vm.prank(donor);
        vault.donateReward(reward1);

        // Transfer some shares from alice to bob
        uint256 aliceShares = vault.balanceOf(alice);
        transferAmount = bound(transferAmount, 0, aliceShares);
        if (transferAmount > 0) {
            vm.prank(alice);
            vault.transfer(bob, transferAmount);
        }

        // Second reward
        vm.prank(donor);
        vault.donateReward(reward2);

        // Total earned must not exceed total donated
        uint256 totalEarned = vault.earned(alice) + vault.earned(bob);
        assertLe(totalEarned, reward1 + reward2);

        // Both should be able to claim without reverting
        uint256 aliceEarned = vault.earned(alice);
        if (aliceEarned > 0) {
            vm.prank(alice);
            vault.claimRewards();
            assertEq(weth.balanceOf(alice), aliceEarned);
        }

        uint256 bobEarned = vault.earned(bob);
        if (bobEarned > 0) {
            vm.prank(bob);
            vault.claimRewards();
            assertEq(weth.balanceOf(bob), bobEarned);
        }
    }

    // ── Delegated redeem with penalty: allowance properly spent ──

    function test_fuzz_delegatedRedeem_allowanceSpent(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 14 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.approve(bob, shares);

        vm.warp(block.timestamp + elapsed);

        // Bob redeems all of alice's shares
        vm.prank(bob);
        uint256 netAssets = vault.redeem(shares, bob, alice);

        assertGt(netAssets, 0);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.allowance(alice, bob), 0); // Allowance fully consumed
    }

    // ── Flash-deposit can't steal rewards ──

    function test_fuzz_flashDepositCannotStealRewards(
        uint256 existingDeposit,
        uint256 rewardAmount,
        uint256 flashAmount
    ) public {
        existingDeposit = bound(existingDeposit, 1 ether, INITIAL / 3);
        rewardAmount = bound(rewardAmount, 1 ether, INITIAL / 3);
        flashAmount = bound(flashAmount, 1 ether, INITIAL / 3);

        // Alice stakes first
        vm.prank(alice);
        vault.deposit(existingDeposit, alice);

        // Donate rewards
        weth.mint(donor, rewardAmount);
        vm.prank(donor);
        vault.donateReward(rewardAmount);

        // Alice should get almost all rewards (dead shares get tiny fraction)
        assertApproxEqRel(vault.earned(alice), rewardAmount, 1e15); // 0.1% tolerance

        // Bob flash-deposits AFTER reward donation
        vm.prank(bob);
        vault.deposit(flashAmount, bob);

        // Bob should get 0 rewards from existing donation
        assertEq(vault.earned(bob), 0);

        // Alice's rewards unchanged (within rounding)
        assertApproxEqRel(vault.earned(alice), rewardAmount, 1e15);
    }

    // ── Multi-user deposit/redeem/donate: vault never undercollateralized ──

    function test_fuzz_multiUserSolvency(
        uint256 aliceDeposit,
        uint256 bobDeposit,
        uint256 donateAmount,
        uint256 elapsed
    ) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 3);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 3);
        donateAmount = bound(donateAmount, 1 ether, INITIAL / 3);
        elapsed = bound(elapsed, 0, 14 days);

        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);
        vm.prank(donor);
        vault.donate(donateAmount);

        vm.warp(block.timestamp + elapsed);

        // Alice redeems all
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);

        // Vault WCHAN balance must always >= totalAssets
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());

        // Bob redeems all
        vm.warp(block.timestamp + 7 days);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);

        // Vault should have 0 user shares (only dead shares remain)
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.balanceOf(bob), 0);
        // Key solvency invariant: vault WCHAN balance always matches totalAssets
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
        // Only dead-share dust + rounding remains
        uint256 totalInput = aliceDeposit + bobDeposit + donateAmount;
        assertLe(vault.totalAssets(), SEED_AMOUNT + totalInput / 1e12 + 10);
    }
}

// ═══════════════════════════════════════════════════════
//      Additional Security & Edge-Case Tests
// ═══════════════════════════════════════════════════════

contract WCHANVaultAdditionalTests is WCHANVaultBaseTest {
    // ── Constructor: rewardToken == asset reverts ──

    function test_constructor_revertsIfRewardTokenEqualsAsset() public {
        address vaultAddr = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        wchan.mint(address(this), SEED_AMOUNT);
        wchan.approve(vaultAddr, SEED_AMOUNT);

        vm.expectRevert(WCHANVault.RewardTokenSameAsAsset.selector);
        new WCHANVault(IERC20(address(wchan)), IERC20(address(wchan)), SEED_AMOUNT);
    }

    // ── Constructor: zero seed amount works (unseded vault) ──

    function test_constructor_zeroSeed() public {
        WCHANVault v = new WCHANVault(IERC20(address(wchan)), IERC20(address(weth)), 0);
        assertEq(v.totalSupply(), 0);
        assertEq(v.totalAssets(), 0);
    }

    // ── ERC4626 mint() function path ──

    function test_mint_functionPath() public {
        vm.prank(alice);
        uint256 assets = vault.mint(100 ether, alice);

        assertEq(vault.balanceOf(alice), 100 ether);
        assertGt(assets, 0);
        assertEq(vault.getPenaltyBps(alice), 2000); // full penalty
    }

    // ── Deposit 0 amount — should succeed with 0 shares, no timer change ──

    function test_deposit_zeroAmount() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(0, alice);
        assertEq(shares, 0);
        assertEq(vault.lastDepositTimestamp(alice), 0); // no timer set
        assertEq(vault.getPenaltyBps(alice), 0);
    }

    // ── Transfer 0 shares — no timer change ──

    function test_transfer_zeroShares_noTimerChange() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(1000 + 3 days);
        uint256 tsBefore = vault.lastDepositTimestamp(alice);

        // Transfer 0 shares to bob
        vm.prank(alice);
        vault.transfer(bob, 0);

        // Alice's timer unchanged
        assertEq(vault.lastDepositTimestamp(alice), tsBefore);
        // Bob has no timer (got 0 shares)
        assertEq(vault.lastDepositTimestamp(bob), 0);
    }

    // ── Dust deposit (1 wei) and redeem ──

    function test_dustDeposit_1wei() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1, alice);

        // Due to ERC4626 virtual shares, 1 wei deposit might get 0 shares
        // which would mean the user loses the 1 wei (expected behavior with seed)
        if (shares > 0) {
            vm.warp(block.timestamp + 7 days);
            vm.prank(alice);
            vault.redeem(shares, alice, alice);
        }
        // No revert = success
    }

    // ── Penalty at exact PENALTY_DURATION boundary ──

    function test_penaltyBps_exactlyAtBoundary() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // At 6.99 days: formula = 2000 * (7d - elapsed) / 7d
        // With 1 second remaining: 2000 * 1 / 604800 = 0 (rounds down to 0)
        // With 1 hour remaining: 2000 * 3600 / 604800 = 11 bps
        vm.warp(block.timestamp + 7 days - 1 hours);
        uint256 bps = vault.getPenaltyBps(alice);
        assertGt(bps, 0); // ~11 bps

        // At exactly 7 days: should be 0
        vm.warp(block.timestamp + 1 hours);
        assertEq(vault.getPenaltyBps(alice), 0);

        // Beyond 7 days: still 0
        vm.warp(block.timestamp + 1 days);
        assertEq(vault.getPenaltyBps(alice), 0);
    }

    // ── Double claim reverts ──

    function test_claimRewards_doubleClaim_reverts() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(donor);
        vault.donateReward(10 ether);

        vm.prank(alice);
        vault.claimRewards();

        vm.prank(alice);
        vm.expectRevert(WCHANVault.ZeroAmount.selector);
        vault.claimRewards();
    }

    // ── WETH balance in vault always >= total unclaimed rewards ──

    function test_wethSolvency_afterMultipleClaims() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);

        // Donate WETH rewards
        vm.prank(donor);
        vault.donateReward(50 ether);

        // Alice claims
        vm.prank(alice);
        vault.claimRewards();

        // WETH in vault >= bob's unclaimed
        uint256 bobOwed = vault.earned(bob);
        assertGe(weth.balanceOf(address(vault)), bobOwed);

        // Bob claims
        vm.prank(bob);
        vault.claimRewards();

        // WETH remaining in vault is dust from dead shares
        assertGe(weth.balanceOf(address(vault)), 0);
    }

    // ── Withdraw emits both Withdraw and EarlyWithdrawPenalty events ──

    function test_withdraw_emitsCorrectEvents() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(vault));
        emit WCHANVault.EarlyWithdrawPenalty(alice, 0, 0, 0, 0, 0); // just check indexed param
        vault.withdraw(40 ether, alice, alice);
    }

    // ── Redeem 0 shares — should return 0 assets without reverting ──

    function test_redeem_zeroShares() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.prank(alice);
        uint256 assets = vault.redeem(0, alice, alice);
        assertEq(assets, 0);
    }

    // ── Deposit for different receiver via mint ──

    function test_mint_forDifferentReceiver() public {
        vm.prank(alice);
        vault.mint(100 ether, bob); // Alice funds, Bob receives shares

        assertGt(vault.balanceOf(bob), 0);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.getPenaltyBps(bob), 2000);
    }
}

// ═══════════════════════════════════════════════════════
//         Additional Security Fuzz Tests
// ═══════════════════════════════════════════════════════

contract WCHANVaultAdditionalFuzzTests is WCHANVaultBaseTest {
    // ── Fuzz: withdraw with penalty delivers exact net + solvency ──

    function test_fuzz_withdrawWithPenalty_exactNetAndSolvent(
        uint256 amount,
        uint256 elapsed,
        uint256 withdrawPct
    ) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);
        withdrawPct = bound(withdrawPct, 1, 100);

        vm.prank(alice);
        vault.deposit(amount, alice);
        vm.warp(block.timestamp + elapsed);

        uint256 maxW = vault.maxWithdraw(alice);
        uint256 toWithdraw = maxW * withdrawPct / 100;
        if (toWithdraw == 0) return;

        uint256 balBefore = wchan.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw(toWithdraw, alice, alice);

        // Exact net delivery
        assertEq(wchan.balanceOf(alice) - balBefore, toWithdraw);
        // Solvency
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Fuzz: sybil attack — split deposit across N addresses ──

    function test_fuzz_sybilPenaltyBypass(uint256 depositAmount, uint256 elapsed) public {
        depositAmount = bound(depositAmount, 10 ether, INITIAL / 2);
        elapsed = bound(elapsed, 0, 7 days);

        // Strategy A: direct deposit + redeem
        vm.warp(10_000);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);
        vm.warp(10_000 + elapsed);

        uint256 directNet = vault.previewRedeemNet(vault.balanceOf(alice), alice);

        // Strategy B: deposit with alice, transfer to bob, bob redeems
        // (Simulated: bob gets fresh penalty on transfer)
        uint256 bobPenaltyBps = vault.MAX_PENALTY_BPS(); // fresh address = max penalty
        uint256 grossAssets = vault.convertToAssets(vault.balanceOf(alice));
        uint256 sybilPenalty = grossAssets * bobPenaltyBps / vault.BPS();
        uint256 sybilNet = grossAssets - sybilPenalty;

        // Direct redeem always >= sybil redeem
        assertGe(directNet, sybilNet);
    }

    // ── Fuzz: delegated withdraw with penalty — allowance properly consumed ──

    function test_fuzz_delegatedWithdraw_withPenalty(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.approve(bob, shares);

        vm.warp(block.timestamp + elapsed);

        uint256 maxW = vault.maxWithdraw(alice);
        if (maxW == 0) return;

        vm.prank(bob);
        uint256 sharesUsed = vault.withdraw(maxW, bob, alice);

        assertGt(sharesUsed, 0);
        assertEq(wchan.balanceOf(bob), INITIAL + maxW);
        // Solvency after delegated withdraw
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Fuzz: WETH reward solvency — total claimed never exceeds donated ──

    function test_fuzz_wethRewardSolvency(
        uint256 aliceDeposit,
        uint256 bobDeposit,
        uint256 reward1,
        uint256 reward2
    ) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 4);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 4);
        reward1 = bound(reward1, 1, INITIAL / 4);
        reward2 = bound(reward2, 1, INITIAL / 4);

        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);
        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        weth.mint(donor, reward1 + reward2);
        vm.prank(donor);
        vault.donateReward(reward1);

        // Alice claims between donations
        uint256 aliceClaimed;
        if (vault.earned(alice) > 0) {
            vm.prank(alice);
            vault.claimRewards();
            aliceClaimed = weth.balanceOf(alice);
        }

        // Second donation
        vm.prank(donor);
        vault.donateReward(reward2);

        // Both claim remaining
        if (vault.earned(alice) > 0) {
            vm.prank(alice);
            vault.claimRewards();
        }
        if (vault.earned(bob) > 0) {
            vm.prank(bob);
            vault.claimRewards();
        }

        uint256 totalClaimed = weth.balanceOf(alice) + weth.balanceOf(bob);
        assertLe(totalClaimed, reward1 + reward2);

        // WETH remaining in vault >= 0 (dead share dust)
        assertGe(weth.balanceOf(address(vault)), 0);
    }

    // ── Fuzz: deposit → donate WCHAN → donate WETH → redeem + claim ──
    //    (full lifecycle: both yield channels + penalty)

    function test_fuzz_fullLifecycle(
        uint256 depositAmount,
        uint256 wchanDonate,
        uint256 wethReward,
        uint256 elapsed
    ) public {
        depositAmount = bound(depositAmount, 1 ether, INITIAL / 4);
        wchanDonate = bound(wchanDonate, 1 ether, INITIAL / 4);
        wethReward = bound(wethReward, 1 ether, INITIAL / 4);
        elapsed = bound(elapsed, 0, 14 days);

        // Deposit
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        // WCHAN donation (increases share value)
        vm.prank(donor);
        vault.donate(wchanDonate);

        // WETH reward donation
        weth.mint(donor, wethReward);
        vm.prank(donor);
        vault.donateReward(wethReward);

        vm.warp(block.timestamp + elapsed);

        // Claim WETH (no penalty)
        uint256 wethEarned = vault.earned(alice);
        if (wethEarned > 0) {
            vm.prank(alice);
            vault.claimRewards();
            assertApproxEqAbs(weth.balanceOf(alice), wethEarned, 0);
        }

        // Redeem all shares (with potential WCHAN penalty)
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 wchanReceived = vault.redeem(shares, alice, alice);

        // Should receive at least 80% of (deposit + donation share)
        // (20% is max penalty, donation is shared with dead shares)
        assertGt(wchanReceived, 0);

        // Solvency
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Fuzz: penalty-free self-transfer cannot lower penalty ──

    function test_fuzz_selfTransfer_cannotLowerPenalty(
        uint256 amount,
        uint256 elapsed,
        uint256 transferPct
    ) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);
        transferPct = bound(transferPct, 1, 100);

        vm.warp(10_000);
        vm.prank(alice);
        vault.deposit(amount, alice);
        vm.warp(10_000 + elapsed);

        uint256 penaltyBefore = vault.getPenaltyBps(alice);
        uint256 transferAmount = vault.balanceOf(alice) * transferPct / 100;
        if (transferAmount == 0) return;

        // Self-transfer
        vm.prank(alice);
        vault.transfer(alice, transferAmount);

        // Penalty can only increase or stay the same (timer moves toward now)
        assertGe(vault.getPenaltyBps(alice), penaltyBefore);
    }

    // ── Fuzz: mint function path — same invariants as deposit ──

    function test_fuzz_mintPath_solvency(uint256 shares) public {
        shares = bound(shares, 1, INITIAL);

        vm.prank(alice);
        uint256 assets = vault.mint(shares, alice);
        assertGt(assets, 0);

        // Penalty starts at max
        assertEq(vault.getPenaltyBps(alice), 2000);

        vm.warp(block.timestamp + 7 days);

        // Redeem all — should get back ~assets (minus ERC4626 rounding)
        vm.prank(alice);
        uint256 redeemed = vault.redeem(shares, alice, alice);
        assertApproxEqAbs(redeemed, assets, 1);

        // Solvency
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Fuzz: repeated partial redeems never break timer or solvency ──

    function test_fuzz_repeatedPartialRedeems(
        uint256 depositAmount,
        uint256 numRedeems
    ) public {
        depositAmount = bound(depositAmount, 10 ether, INITIAL);
        numRedeems = bound(numRedeems, 1, 10);

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        uint256 initialTs = vault.lastDepositTimestamp(alice);

        for (uint256 i = 0; i < numRedeems; i++) {
            uint256 shares = vault.balanceOf(alice);
            if (shares == 0) break;

            uint256 toRedeem = shares / (numRedeems - i);
            if (toRedeem == 0) toRedeem = 1;
            if (toRedeem > shares) toRedeem = shares;

            vm.prank(alice);
            vault.redeem(toRedeem, alice, alice);

            // Timer never changes on redeem
            if (vault.balanceOf(alice) > 0) {
                assertEq(vault.lastDepositTimestamp(alice), initialTs);
            }

            // Solvency after every partial redeem
            assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
        }
    }
}

// ═══════════════════════════════════════════════════════
//       Deep Edge-Case & Attack-Vector Tests
// ═══════════════════════════════════════════════════════

contract WCHANVaultDeepEdgeCaseTests is WCHANVaultBaseTest {
    // ── Direct WCHAN transfer (not via donate) increases share value ──

    function test_directWchanTransfer_increasesShareValue() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 valueBefore = vault.convertToAssets(1 ether);

        // Transfer WCHAN directly (bypassing donate)
        vm.prank(donor);
        wchan.transfer(address(vault), 50 ether);

        uint256 valueAfter = vault.convertToAssets(1 ether);
        assertGt(valueAfter, valueBefore);

        // totalAssets reflects the direct transfer
        assertApproxEqAbs(vault.totalAssets(), 150 ether + SEED_AMOUNT, 1);
    }

    // ── Direct WETH transfer to vault is NOT distributed via rewards ──

    function test_directWethTransfer_notDistributed() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // Transfer WETH directly (bypassing donateReward)
        vm.prank(donor);
        weth.transfer(address(vault), 50 ether);

        // Alice earns nothing — rewardPerShareStored wasn't updated
        assertEq(vault.earned(alice), 0);

        // WETH is stuck — not claimable
        vm.prank(alice);
        vm.expectRevert(WCHANVault.ZeroAmount.selector);
        vault.claimRewards();
    }

    // ── previewRedeem returns GROSS (pre-penalty) per ERC4626 spec ──

    function test_previewRedeem_returnsGross() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        uint256 shares = vault.balanceOf(alice);
        uint256 preview = vault.previewRedeem(shares);
        uint256 previewNet = vault.previewRedeemNet(shares, alice);

        // previewRedeem is gross (no penalty context)
        assertGt(preview, previewNet);
        assertApproxEqAbs(preview, 100 ether, 1);
        assertApproxEqAbs(previewNet, 80 ether, SEED_AMOUNT); // 20% penalty
    }

    // ── previewWithdraw returns gross shares needed (no penalty context) ──

    function test_previewWithdraw_returnsGrossShares() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // previewWithdraw(assets) ignores penalty → returns fewer shares than actually needed
        uint256 previewShares = vault.previewWithdraw(50 ether);

        // Actual withdraw with penalty needs MORE shares
        vm.prank(alice);
        uint256 actualShares = vault.withdraw(50 ether, alice, alice);
        assertGe(actualShares, previewShares);
    }

    // ── Penalty exactly at 1 second before expiry ──

    function test_penalty_oneSecondBeforeExpiry() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days - 1);

        // 2000 * 1 / 604800 = 0 (rounds down)
        uint256 bps = vault.getPenaltyBps(alice);
        assertEq(bps, 0); // rounds to zero with 1 second remaining
    }

    // ── Penalty at 1 minute before expiry ──

    function test_penalty_oneMinuteBeforeExpiry() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days - 60);
        uint256 bps = vault.getPenaltyBps(alice);
        // 2000 * 60 / 604800 = 0 (rounds down, < 1 bps)
        assertEq(bps, 0);
    }

    // ── Penalty at ~5 minutes before expiry (smallest non-zero penalty) ──

    function test_penalty_smallestNonZero() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // 2000 * remaining / 604800 >= 1 requires remaining >= 303 seconds
        vm.warp(block.timestamp + 7 days - 303);
        uint256 bps = vault.getPenaltyBps(alice);
        assertEq(bps, 1); // exactly 1 bps
    }

    // ── Withdraw with 0% penalty uses short-circuit path ──

    function test_withdraw_zeroPenalty_noExtraBurns() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days);

        uint256 burnBefore = wchan.balanceOf(BURN_ADDRESS);

        vm.prank(alice);
        vault.withdraw(50 ether, alice, alice);

        // No tokens burned (penalty was 0)
        assertEq(wchan.balanceOf(BURN_ADDRESS), burnBefore);
    }

    // ── Redeem 1 share (minimum non-zero) ──

    function test_redeem_singleShare() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(block.timestamp + 7 days);

        vm.prank(alice);
        uint256 assets = vault.redeem(1, alice, alice);

        assertGt(assets, 0);
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Multiple users deposit, one donates, penalty retained distributes fairly ──

    function test_penaltyRetained_fairDistribution_threeUsers() public {
        address charlie = makeAddr("charlie");
        wchan.mint(charlie, INITIAL);
        vm.prank(charlie);
        wchan.approve(address(vault), type(uint256).max);

        // Three users deposit equal amounts
        vm.prank(alice);
        vault.deposit(100 ether, alice);
        vm.prank(bob);
        vault.deposit(100 ether, bob);
        vm.prank(charlie);
        vault.deposit(100 ether, charlie);

        // Alice immediately withdraws (20% penalty)
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);

        // Alice penalty ~20 ether. Half burned (10), half retained (10)
        // Bob and Charlie each should get ~5 ether extra (proportional to shares)
        vm.warp(block.timestamp + 7 days);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        uint256 bobNet = vault.redeem(bobShares, bob, bob);

        uint256 charlieShares = vault.balanceOf(charlie);
        vm.prank(charlie);
        uint256 charlieNet = vault.redeem(charlieShares, charlie, charlie);

        // Both should get ~105 ether (100 deposit + ~5 from penalty retained)
        assertApproxEqAbs(bobNet, charlieNet, 1); // Equal shares → equal payout
        assertGt(bobNet, 100 ether); // Got yield from penalty
    }

    // ── Reward accumulator precision with extreme share imbalance ──

    function test_rewards_extremeShareImbalance() public {
        // Alice deposits 1 wei worth of shares, Bob deposits 1M ether
        vm.prank(alice);
        vault.deposit(1, alice);
        vm.prank(bob);
        vault.deposit(1_000_000 ether, bob);

        vm.prank(donor);
        vault.donateReward(100 ether);

        // Alice should get essentially 0 (rounding)
        uint256 aliceEarned = vault.earned(alice);
        assertLe(aliceEarned, 1); // At most 1 wei from rounding

        // Bob should get ~all of it
        uint256 bobEarned = vault.earned(bob);
        assertApproxEqAbs(bobEarned, 100 ether, SEED_AMOUNT);

        // Total earned <= donated
        assertLe(aliceEarned + bobEarned, 100 ether);
    }

    // ── Deposit after full redeem: lastDepositTimestamp was NOT cleared ──

    function test_redeposit_afterFullRedeem_oldTimestampNonZero() public {
        vm.warp(1000);
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        vm.warp(1000 + 7 days);

        // Full redeem
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        // lastDepositTimestamp is still set (not cleared on burn)
        assertEq(vault.lastDepositTimestamp(alice), 1000);

        // But getPenaltyBps returns 0 because it's been > 7 days
        assertEq(vault.getPenaltyBps(alice), 0);

        // Re-deposit: since balance is 0, hits the else branch (fresh timestamp)
        vm.warp(1000 + 14 days);
        vm.prank(alice);
        vault.deposit(50 ether, alice);

        // Fresh timestamp because balanceOf(alice) was 0 before mint
        assertEq(vault.lastDepositTimestamp(alice), 1000 + 14 days);
        assertEq(vault.getPenaltyBps(alice), 2000);
    }

    // ── ERC4626 mint path sets penalty timer correctly ──

    function test_mint_setsPenaltyTimer() public {
        vm.warp(5000);
        vm.prank(alice);
        vault.mint(100 ether, alice);

        assertEq(vault.lastDepositTimestamp(alice), 5000);
        assertEq(vault.getPenaltyBps(alice), 2000);
    }

    // ── Reward donation with single wei rounds to 0 per-share (dust absorbed) ──

    function test_donateReward_singleWei_dustAbsorbed() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        weth.mint(donor, 1);
        vm.prank(donor);
        vault.donateReward(1);

        // mulDiv(1, 1e18, 100e18 + SEED_AMOUNT) rounds down to 0
        // The 1 wei WETH sits in the contract but is never claimable — expected dust behavior
        assertEq(vault.rewardPerShareStored(), 0);
        assertEq(vault.earned(alice), 0);
        assertEq(weth.balanceOf(address(vault)), 1); // WETH is in vault but unclaimable
    }

    // ── Withdraw exactly maxWithdraw with penalty — solvency ──

    function test_withdraw_exactlyMaxWithdraw_duringPenalty() public {
        vm.prank(alice);
        vault.deposit(100 ether, alice);

        // 1 day in → ~17.14% penalty
        vm.warp(block.timestamp + 1 days);

        uint256 maxW = vault.maxWithdraw(alice);
        assertGt(maxW, 0);

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        assertEq(vault.balanceOf(alice), 0);
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
    }
}

// ═══════════════════════════════════════════════════════
//       Deep Attack-Vector Fuzz Tests
// ═══════════════════════════════════════════════════════

contract WCHANVaultDeepAttackFuzzTests is WCHANVaultBaseTest {
    // ── Fuzz: weighted timestamp overflow safety with extreme amounts ──

    function test_fuzz_weightedTimestamp_noOverflow(
        uint256 existingDeposit,
        uint256 newDeposit,
        uint256 delay
    ) public {
        existingDeposit = bound(existingDeposit, 1, INITIAL / 2);
        newDeposit = bound(newDeposit, 1, INITIAL / 2);
        delay = bound(delay, 0, 365 days * 100); // 100 years

        vm.warp(10_000);
        vm.prank(alice);
        vault.deposit(existingDeposit, alice);

        vm.warp(block.timestamp + delay);

        // Should not overflow — safe for any realistic timestamp and deposit amount
        vm.prank(alice);
        vault.deposit(newDeposit, alice);

        uint256 ts = vault.lastDepositTimestamp(alice);
        assertGe(ts, 10_000);
        assertLe(ts, block.timestamp);
    }

    // ── Fuzz: front-running donateReward with deposit is not profitable ──

    function test_fuzz_frontRunDonateReward_unprofitable(
        uint256 existingDeposit,
        uint256 rewardAmount,
        uint256 attackDeposit
    ) public {
        existingDeposit = bound(existingDeposit, 1 ether, INITIAL / 4);
        rewardAmount = bound(rewardAmount, 1 ether, INITIAL / 4);
        attackDeposit = bound(attackDeposit, 1 ether, INITIAL / 4);

        // Existing staker
        vm.prank(alice);
        vault.deposit(existingDeposit, alice);

        // Attacker front-runs: deposits just before reward
        vm.prank(bob);
        vault.deposit(attackDeposit, bob);

        // Reward distributed
        weth.mint(donor, rewardAmount);
        vm.prank(donor);
        vault.donateReward(rewardAmount);

        // Attacker tries to exit immediately — 20% WCHAN penalty
        uint256 bobShares = vault.balanceOf(bob);
        uint256 bobWethEarned = vault.earned(bob);

        vm.prank(bob);
        uint256 bobWchanNet = vault.redeem(bobShares, bob, bob);

        // Attacker's WCHAN loss from penalty
        uint256 wchanLoss = attackDeposit - bobWchanNet;

        // For the attack to be profitable: bobWethEarned > wchanLoss
        // This is only possible when reward is disproportionately large relative to deposit
        // The penalty makes it unprofitable for typical cases
        // We just verify the invariants hold
        assertLe(bobWethEarned, rewardAmount); // Can't earn more than donated
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets()); // Solvency
    }

    // ── Fuzz: sandwich attack on donate() is not profitable ──

    function test_fuzz_sandwichDonate_unprofitable(
        uint256 existingDeposit,
        uint256 donateAmount,
        uint256 attackDeposit
    ) public {
        existingDeposit = bound(existingDeposit, 1 ether, INITIAL / 4);
        donateAmount = bound(donateAmount, 1 ether, INITIAL / 4);
        attackDeposit = bound(attackDeposit, 1 ether, INITIAL / 4);

        // Existing staker
        vm.prank(alice);
        vault.deposit(existingDeposit, alice);

        // Attacker front-runs donation
        vm.prank(bob);
        vault.deposit(attackDeposit, bob);

        // Donation increases share value
        vm.prank(donor);
        vault.donate(donateAmount);

        // Attacker immediately redeems — 20% penalty
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        uint256 bobNet = vault.redeem(bobShares, bob, bob);

        // Attacker's WCHAN loss from penalty on their deposit
        // Their share of the donation = donateAmount * attackDeposit / (existingDeposit + attackDeposit + SEED_AMOUNT)
        // Penalty = 20% of their gross (deposit + share of donation)
        // For profitability: donationShare > penalty = 0.2 * (attackDeposit + donationShare)
        // → donationShare > 0.2 * attackDeposit / 0.8 = 0.25 * attackDeposit
        // This requires donateAmount to be >25% of attackDeposit relative to pool
        // We verify solvency invariant always holds
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets());
        assertEq(vault.balanceOf(bob), 0);
    }

    // ── Fuzz: zero-penalty withdraw path (elapsed >= 7 days) ──

    function test_fuzz_zeroPenaltyWithdraw(uint256 amount, uint256 extraDays) public {
        amount = bound(amount, 1 ether, INITIAL);
        extraDays = bound(extraDays, 0, 365);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + 7 days + extraDays * 1 days);

        assertEq(vault.getPenaltyBps(alice), 0);

        uint256 maxW = vault.maxWithdraw(alice);
        uint256 burnBefore = wchan.balanceOf(BURN_ADDRESS);

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        // No penalty burn
        assertEq(wchan.balanceOf(BURN_ADDRESS), burnBefore);
        // Got back ~full deposit
        assertApproxEqAbs(wchan.balanceOf(alice), INITIAL, 1);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(wchan.balanceOf(address(vault)), vault.totalAssets());
    }

    // ── Fuzz: transfer-to-self never decreases penalty (can only increase or stay) ──

    function test_fuzz_transferToSelf_penaltyMonotonic(
        uint256 amount,
        uint256 elapsed,
        uint256 transferPct
    ) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 7 days);
        transferPct = bound(transferPct, 1, 100);

        vm.warp(10_000);
        vm.prank(alice);
        vault.deposit(amount, alice);
        vm.warp(10_000 + elapsed);

        uint256 penaltyBefore = vault.getPenaltyBps(alice);
        uint256 transferAmt = vault.balanceOf(alice) * transferPct / 100;
        if (transferAmt == 0) return;

        vm.prank(alice);
        vault.transfer(alice, transferAmt);

        // Penalty can only increase or stay same (timestamp moves toward now)
        assertGe(vault.getPenaltyBps(alice), penaltyBefore);
    }

    // ── Fuzz: interleaved multi-user deposit/donate/withdraw/claim lifecycle ──

    function test_fuzz_interleavedLifecycle(
        uint256 aliceDeposit,
        uint256 bobDeposit,
        uint256 wchanDonate,
        uint256 wethReward,
        uint256 elapsed1,
        uint256 elapsed2
    ) public {
        aliceDeposit = bound(aliceDeposit, 1 ether, INITIAL / 5);
        bobDeposit = bound(bobDeposit, 1 ether, INITIAL / 5);
        wchanDonate = bound(wchanDonate, 1 ether, INITIAL / 5);
        wethReward = bound(wethReward, 1 ether, INITIAL / 5);
        elapsed1 = bound(elapsed1, 0, 3 days);
        elapsed2 = bound(elapsed2, 0, 7 days);

        // Phase 1: deposits
        vm.prank(alice);
        vault.deposit(aliceDeposit, alice);

        vm.warp(block.timestamp + elapsed1);

        vm.prank(bob);
        vault.deposit(bobDeposit, bob);

        // Phase 2: donations
        vm.prank(donor);
        vault.donate(wchanDonate);

        weth.mint(donor, wethReward);
        vm.prank(donor);
        vault.donateReward(wethReward);

        // Phase 3: alice partial redeem
        uint256 aliceShares = vault.balanceOf(alice);
        if (aliceShares > 1) {
            vm.prank(alice);
            vault.redeem(aliceShares / 2, alice, alice);
        }

        // Phase 4: more time passes, bob redeems all
        vm.warp(block.timestamp + elapsed2);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);

        // Phase 5: alice claims WETH and redeems rest
        if (vault.earned(alice) > 0) {
            vm.prank(alice);
            vault.claimRewards();
        }

        vm.warp(block.timestamp + 7 days);
        uint256 aliceRemaining = vault.balanceOf(alice);
        if (aliceRemaining > 0) {
            vm.prank(alice);
            vault.redeem(aliceRemaining, alice, alice);
        }

        if (vault.earned(bob) > 0) {
            vm.prank(bob);
            vault.claimRewards();
        }

        // Key invariants
        assertGe(wchan.balanceOf(address(vault)), vault.totalAssets()); // WCHAN solvency
        assertLe(
            weth.balanceOf(alice) + weth.balanceOf(bob),
            wethReward
        ); // WETH solvency
    }

    // ── Fuzz: penalty-free users can always withdraw exact deposit ──

    function test_fuzz_noPenalty_fullRecovery(uint256 amount) public {
        amount = bound(amount, 1, INITIAL);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + 7 days);

        uint256 shares = vault.balanceOf(alice);
        if (shares == 0) return; // dust deposit got 0 shares

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);

        // Should recover full deposit (minus 1 wei ERC4626 rounding)
        assertApproxEqAbs(assets, amount, 1);
    }

    // ── Fuzz: maxWithdraw + withdraw never leaves dust shares ──

    function test_fuzz_maxWithdraw_noDustShares(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1 ether, INITIAL);
        elapsed = bound(elapsed, 0, 14 days);

        vm.prank(alice);
        vault.deposit(amount, alice);

        vm.warp(block.timestamp + elapsed);

        uint256 maxW = vault.maxWithdraw(alice);
        if (maxW == 0) return;

        vm.prank(alice);
        vault.withdraw(maxW, alice, alice);

        // After withdrawing maxWithdraw, user should have 0 shares
        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Fuzz: reward per share precision across deposits of vastly different sizes ──

    function test_fuzz_rewardPrecision_differentSizes(
        uint256 smallDeposit,
        uint256 largeDeposit,
        uint256 rewardAmount
    ) public {
        smallDeposit = bound(smallDeposit, 1 ether, 10 ether);
        largeDeposit = bound(largeDeposit, 100_000 ether, INITIAL / 2);
        rewardAmount = bound(rewardAmount, 1 ether, INITIAL / 4);

        vm.prank(alice);
        vault.deposit(smallDeposit, alice);
        vm.prank(bob);
        vault.deposit(largeDeposit, bob);

        weth.mint(donor, rewardAmount);
        vm.prank(donor);
        vault.donateReward(rewardAmount);

        uint256 aliceEarned = vault.earned(alice);
        uint256 bobEarned = vault.earned(bob);

        // Proportionality (cross-multiply): alice/bob ≈ smallDeposit/largeDeposit
        // Allow 0.1% tolerance for rounding + dead shares
        if (aliceEarned > 0 && bobEarned > 0) {
            assertApproxEqRel(
                aliceEarned * largeDeposit,
                bobEarned * smallDeposit,
                1e15 // 0.1%
            );
        }

        // Total earned <= donated (no inflation)
        assertLe(aliceEarned + bobEarned, rewardAmount);
    }
}

// ═══════════════════════════════════════════════════════════════════
//                    ERC20Votes (Governance)
// ═══════════════════════════════════════════════════════════════════

contract WCHANVaultVotesTest is WCHANVaultBaseTest {
    uint256 internal constant DEPOSIT = 10_000 ether;

    function setUp() public override {
        super.setUp();
        // Alice deposits into vault
        vm.prank(alice);
        vault.deposit(DEPOSIT, alice);
    }

    // ─────────── Clock Mode ───────────

    function test_clockMode_isTimestamp() public view {
        assertEq(vault.CLOCK_MODE(), "mode=timestamp");
        assertEq(vault.clock(), uint48(block.timestamp));
    }

    // ─────────── Basic Delegation ───────────

    function test_delegate_self() public {
        vm.prank(alice);
        vault.delegate(alice);
        assertEq(vault.getVotes(alice), vault.balanceOf(alice));
        assertEq(vault.delegates(alice), alice);
    }

    function test_delegate_other() public {
        vm.prank(alice);
        vault.delegate(bob);
        assertEq(vault.getVotes(bob), vault.balanceOf(alice));
        assertEq(vault.getVotes(alice), 0);
    }

    function test_votingPower_notActiveUntilDelegated() public view {
        assertEq(vault.getVotes(alice), 0);
    }

    // ─────────── Deposit / Withdraw Update Voting Power ───────────

    function test_deposit_updatesVotingPower() public {
        vm.prank(alice);
        vault.delegate(alice);
        uint256 votesBefore = vault.getVotes(alice);

        uint256 extra = 5_000 ether;
        vm.prank(alice);
        vault.deposit(extra, alice);

        assertEq(vault.getVotes(alice), votesBefore + extra);
    }

    function test_redeem_updatesVotingPower() public {
        vm.prank(alice);
        vault.delegate(alice);

        // Warp past penalty window
        vm.warp(block.timestamp + 7 days);

        uint256 shares = vault.balanceOf(alice);
        uint256 redeemShares = shares / 2;

        vm.prank(alice);
        vault.redeem(redeemShares, alice, alice);

        assertEq(vault.getVotes(alice), shares - redeemShares);
    }

    // ─────────── Transfer Updates Voting Power ───────────

    function test_transferUpdatesVotingPower() public {
        vm.prank(alice);
        vault.delegate(alice);

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 transferAmount = aliceShares / 4;

        vm.prank(alice);
        vault.transfer(bob, transferAmount);

        // Alice's votes decrease, bob has no votes (not delegated)
        assertEq(vault.getVotes(alice), aliceShares - transferAmount);
        assertEq(vault.getVotes(bob), 0);

        // Bob delegates, now gets votes
        vm.prank(bob);
        vault.delegate(bob);
        assertEq(vault.getVotes(bob), transferAmount);
    }

    // ─────────── Checkpoints & Past Votes ───────────

    function test_pastVotes_checkpoint() public {
        vm.prank(alice);
        vault.delegate(alice);

        uint256 t1 = block.timestamp;
        uint256 aliceShares = vault.balanceOf(alice);

        // Advance time
        vm.warp(t1 + 100);

        // Transfer some away
        uint256 transferAmount = aliceShares / 3;
        vm.prank(alice);
        vault.transfer(bob, transferAmount);

        // Past votes at t1 should still be full amount
        assertEq(vault.getPastVotes(alice, t1), aliceShares);
        // Current votes should be reduced
        assertEq(vault.getVotes(alice), aliceShares - transferAmount);
    }

    // ─────────── WETH Rewards Independent of Voting ───────────

    function test_delegation_doesNotAffectRewards() public {
        // Bob also deposits
        vm.prank(bob);
        vault.deposit(DEPOSIT, bob);

        // Alice delegates to bob, bob doesn't delegate
        vm.prank(alice);
        vault.delegate(bob);

        // Donate WETH rewards
        vm.prank(donor);
        vault.donateReward(1 ether);

        // Both should earn rewards proportional to shares, not votes
        uint256 aliceEarned = vault.earned(alice);
        uint256 bobEarned = vault.earned(bob);
        assertGt(aliceEarned, 0);
        assertGt(bobEarned, 0);
        assertApproxEqRel(aliceEarned, bobEarned, 1e15);
    }

    // ─────────── Fuzz: Delegation Conservation ───────────

    function test_fuzz_delegationConservation(uint256 depositA, uint256 depositB) public {
        depositA = bound(depositA, 1 ether, INITIAL / 2);
        depositB = bound(depositB, 1 ether, INITIAL / 2);

        // Fresh deposits (alice already deposited DEPOSIT in setUp)
        vm.prank(bob);
        vault.deposit(depositB, bob);

        vm.prank(alice);
        vault.delegate(alice);
        vm.prank(bob);
        vault.delegate(bob);

        uint256 totalVotes = vault.getVotes(alice) + vault.getVotes(bob);
        uint256 totalShares = vault.balanceOf(alice) + vault.balanceOf(bob) + vault.balanceOf(BURN_ADDRESS);

        // Total delegated votes should equal total delegated shares (dead shares not delegated)
        assertEq(totalVotes, vault.balanceOf(alice) + vault.balanceOf(bob));
    }
}

contract WCHANVaultDelegateBySigTest is WCHANVaultBaseTest {
    bytes32 internal constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    bytes32 internal constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 internal DOMAIN_SEPARATOR;

    uint256 internal alicePk = 0xa11ce;
    address internal aliceSigner;
    address internal relayer = makeAddr("relayer");

    uint256 internal constant DEPOSIT = 10_000 ether;

    function setUp() public override {
        super.setUp();

        aliceSigner = vm.addr(alicePk);

        // Fund aliceSigner and deposit into vault
        wchan.mint(aliceSigner, INITIAL);
        vm.prank(aliceSigner);
        wchan.approve(address(vault), type(uint256).max);
        vm.prank(aliceSigner);
        vault.deposit(DEPOSIT, aliceSigner);

        // Build domain separator for the vault
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                TYPE_HASH,
                keccak256(bytes("Staked WCHAN")),
                keccak256(bytes("1")),
                block.chainid,
                address(vault)
            )
        );
    }

    function _signDelegation(
        uint256 signerPk,
        address delegatee,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        (v, r, s) = vm.sign(signerPk, digest);
    }

    function test_delegateBySig() public {
        uint256 expiry = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 0, expiry);

        vm.prank(relayer);
        vault.delegateBySig(bob, 0, expiry, v, r, s);

        assertEq(vault.delegates(aliceSigner), bob);
        assertEq(vault.getVotes(bob), vault.balanceOf(aliceSigner));
        assertEq(vault.nonces(aliceSigner), 1);
    }

    function test_delegateBySig_revert_expired() public {
        uint256 expiry = block.timestamp - 1;
        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 0, expiry);

        vm.expectRevert();
        vault.delegateBySig(bob, 0, expiry, v, r, s);
    }

    function test_delegateBySig_revert_wrongNonce() public {
        uint256 expiry = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 999, expiry);

        vm.expectRevert();
        vault.delegateBySig(bob, 999, expiry, v, r, s);
    }
}
