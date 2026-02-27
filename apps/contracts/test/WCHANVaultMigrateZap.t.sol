// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {WCHANVault} from "../src/WCHANVault.sol";
import {WCHANVaultMigrateZap, IWCHAN} from "../src/WCHANVaultMigrateZap.sol";

// ── Mocks ──

contract MockOldToken is ERC20 {
    constructor() ERC20("BNKRW", "BNKRW") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mimics real WCHAN wrap/unwrap behavior
contract MockWCHAN is ERC20 {
    IERC20 public immutable OLD_TOKEN;

    constructor(IERC20 oldToken_) ERC20("WalletChan", "WCHAN") {
        OLD_TOKEN = oldToken_;
        _mint(address(this), 100_000_000_000 ether);
    }

    function wrap(uint256 amount_) external {
        _transfer(address(this), msg.sender, amount_);
        OLD_TOKEN.transferFrom(msg.sender, address(this), amount_);
    }
}

/// @dev Simple ERC4626 vault with no penalty (simulates the old sBNKRW vault)
contract MockOldVault is ERC4626 {
    constructor(
        IERC20 asset_
    ) ERC4626(asset_) ERC20("Staked BNKRW", "sBNKRW") {}
}

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ── Tests ──

contract WCHANVaultMigrateZapTest is Test {
    MockOldToken public oldToken;
    MockWCHAN public wchan;
    MockWETH public weth;
    MockOldVault public oldVault;
    WCHANVault public newVault;
    WCHANVaultMigrateZap public zap;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant SEED_AMOUNT = 1e6;
    uint256 internal constant INITIAL = 1_000_000 ether;

    function setUp() public {
        // Deploy tokens
        oldToken = new MockOldToken();
        wchan = new MockWCHAN(IERC20(address(oldToken)));
        weth = new MockWETH();

        // Deploy old vault (no penalty)
        oldVault = new MockOldVault(IERC20(address(oldToken)));

        // Deploy new vault (with seed for inflation protection)
        oldToken.mint(address(this), SEED_AMOUNT);
        oldToken.approve(address(wchan), SEED_AMOUNT);
        wchan.wrap(SEED_AMOUNT);

        address newVaultAddr = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        IERC20(address(wchan)).approve(newVaultAddr, SEED_AMOUNT);
        newVault = new WCHANVault(IERC20(address(wchan)), IERC20(address(weth)), SEED_AMOUNT);

        // Deploy zap
        zap = new WCHANVaultMigrateZap(
            IERC4626(address(oldVault)),
            IERC4626(address(newVault)),
            IWCHAN(address(wchan)),
            IERC20(address(oldToken))
        );

        // Fund alice with OLD_TOKEN and deposit into old vault
        oldToken.mint(alice, INITIAL);
        vm.startPrank(alice);
        oldToken.approve(address(oldVault), type(uint256).max);
        oldVault.deposit(INITIAL, alice);
        vm.stopPrank();

        // Fund bob similarly
        oldToken.mint(bob, INITIAL);
        vm.startPrank(bob);
        oldToken.approve(address(oldVault), type(uint256).max);
        oldVault.deposit(INITIAL, bob);
        vm.stopPrank();
    }

    // ── Helpers ──

    function _approveAndMigrate(address user, uint256 shares) internal returns (uint256) {
        vm.startPrank(user);
        oldVault.approve(address(zap), shares);
        uint256 newShares = zap.migrate(shares);
        vm.stopPrank();
        return newShares;
    }

    // ── Tests ──

    function test_migrate_fullBalance() public {
        uint256 oldShares = oldVault.balanceOf(alice);
        assertGt(oldShares, 0);

        uint256 newShares = _approveAndMigrate(alice, oldShares);

        // Old vault: alice has no shares left
        assertEq(oldVault.balanceOf(alice), 0);

        // New vault: alice has sWCHAN shares
        assertGt(newShares, 0);
        assertEq(newVault.balanceOf(alice), newShares);

        // Zap holds no tokens
        assertEq(oldToken.balanceOf(address(zap)), 0);
        assertEq(IERC20(address(wchan)).balanceOf(address(zap)), 0);
        assertEq(oldVault.balanceOf(address(zap)), 0);
        assertEq(newVault.balanceOf(address(zap)), 0);
    }

    function test_migrate_partialBalance() public {
        uint256 oldShares = oldVault.balanceOf(alice);
        uint256 halfShares = oldShares / 2;

        uint256 newShares = _approveAndMigrate(alice, halfShares);

        // Alice still has remaining old shares
        assertApproxEqAbs(oldVault.balanceOf(alice), oldShares - halfShares, 1);

        // Alice has new vault shares
        assertGt(newShares, 0);
        assertEq(newVault.balanceOf(alice), newShares);
    }

    function test_migrate_revertsOnZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(WCHANVaultMigrateZap.ZeroShares.selector);
        zap.migrate(0);
    }

    function test_migrate_multipleUsers() public {
        uint256 aliceOldShares = oldVault.balanceOf(alice);
        uint256 bobOldShares = oldVault.balanceOf(bob);

        uint256 aliceNew = _approveAndMigrate(alice, aliceOldShares);
        uint256 bobNew = _approveAndMigrate(bob, bobOldShares);

        // Both users have new vault shares
        assertEq(newVault.balanceOf(alice), aliceNew);
        assertEq(newVault.balanceOf(bob), bobNew);

        // Both fully exited old vault
        assertEq(oldVault.balanceOf(alice), 0);
        assertEq(oldVault.balanceOf(bob), 0);
    }

    function test_migrate_setsNewVaultPenaltyTimer() public {
        uint256 oldShares = oldVault.balanceOf(alice);
        _approveAndMigrate(alice, oldShares);

        // Alice should have a fresh penalty timer in the new vault
        assertEq(newVault.lastDepositTimestamp(alice), block.timestamp);
        assertEq(newVault.getPenaltyBps(alice), 2000); // 20% max penalty
    }

    function test_migrate_withAppreciatedOldVault() public {
        // Simulate yield in old vault (donate OLD_TOKEN directly)
        uint256 donation = 100_000 ether;
        oldToken.mint(address(oldVault), donation);

        // Alice's shares are now worth more OLD_TOKEN
        uint256 aliceOldShares = oldVault.balanceOf(alice);
        uint256 expectedOldToken = oldVault.previewRedeem(aliceOldShares);
        assertGt(expectedOldToken, INITIAL); // worth more than initial deposit

        uint256 newShares = _approveAndMigrate(alice, aliceOldShares);

        // New vault shares should reflect the full appreciated amount
        assertGt(newShares, 0);
        assertEq(newVault.balanceOf(alice), newShares);

        // Zap is clean
        assertEq(oldToken.balanceOf(address(zap)), 0);
        assertEq(IERC20(address(wchan)).balanceOf(address(zap)), 0);
    }

    function test_migrate_revertsWithoutApproval() public {
        uint256 shares = oldVault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(); // ERC20InsufficientAllowance
        zap.migrate(shares);
    }

    function test_constructorApprovals() public view {
        // OLD_TOKEN approved to WCHAN
        assertEq(
            oldToken.allowance(address(zap), address(wchan)),
            type(uint256).max
        );
        // WCHAN approved to new vault
        assertEq(
            IERC20(address(wchan)).allowance(address(zap), address(newVault)),
            type(uint256).max
        );
    }

    function test_immutables() public view {
        assertEq(address(zap.oldVault()), address(oldVault));
        assertEq(address(zap.newVault()), address(newVault));
        assertEq(address(zap.wchan()), address(wchan));
        assertEq(address(zap.oldToken()), address(oldToken));
    }
}

// ═══════════════════════════════════════════════════════
//               Fork Tests (Base Mainnet)
// ═══════════════════════════════════════════════════════

contract WCHANVaultMigrateZapForkTest is Test {
    // Base mainnet addresses
    address constant OLD_VAULT = 0x7ac242481d5122c4d3400492aF6ADfBce21D7113;
    address constant NEW_VAULT = 0x3F5ac2c27BBf08522Bc1F5C92237E137356A8AC8;
    address constant WCHAN_ADDR = 0xBa5ED0000e1CA9136a695f0a848012A16008B032;
    address constant OLD_TOKEN = 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07;
    address constant USER = 0x74992be74bc3c3A72E97dF34A2C3A62c15f55970;

    uint256 constant FORK_BLOCK = 42709869;

    IERC4626 oldVault = IERC4626(OLD_VAULT);
    IERC4626 newVault = IERC4626(NEW_VAULT);
    WCHANVaultMigrateZap public zap;

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"), FORK_BLOCK);

        zap = new WCHANVaultMigrateZap(
            oldVault,
            newVault,
            IWCHAN(WCHAN_ADDR),
            IERC20(OLD_TOKEN)
        );
    }

    function test_fork_userHasOldVaultShares() public view {
        uint256 shares = oldVault.balanceOf(USER);
        assertGt(shares, 0, "User should have old vault shares at this block");
    }

    function test_fork_migrate_full() public {
        uint256 oldShares = oldVault.balanceOf(USER);
        assertGt(oldShares, 0);

        uint256 oldTokenAmount = oldVault.previewRedeem(oldShares);
        uint256 newVaultSharesBefore = IERC20(address(newVault)).balanceOf(USER);

        // Approve and migrate
        vm.startPrank(USER);
        IERC20(OLD_VAULT).approve(address(zap), oldShares);
        uint256 newShares = zap.migrate(oldShares);
        vm.stopPrank();

        // Old vault fully exited
        assertEq(oldVault.balanceOf(USER), 0, "Old vault shares should be 0");

        // New vault shares received
        assertGt(newShares, 0, "Should receive new vault shares");
        assertEq(
            IERC20(address(newVault)).balanceOf(USER),
            newVaultSharesBefore + newShares,
            "New vault balance should increase by newShares"
        );

        // Zap holds nothing
        assertEq(IERC20(OLD_TOKEN).balanceOf(address(zap)), 0, "Zap should hold no OLD_TOKEN");
        assertEq(IERC20(WCHAN_ADDR).balanceOf(address(zap)), 0, "Zap should hold no WCHAN");
        assertEq(oldVault.balanceOf(address(zap)), 0, "Zap should hold no old vault shares");
        assertEq(IERC20(address(newVault)).balanceOf(address(zap)), 0, "Zap should hold no new vault shares");

        // The WCHAN deposited into the new vault should equal old token redeemed (1:1 wrap)
        // We verify via the new vault's deposit amount matching the old redeem preview
        // (within rounding tolerance from vault share math)
        uint256 newVaultAssets = newVault.previewRedeem(newShares);
        // newVaultAssets may differ slightly due to share rounding
        assertApproxEqAbs(newVaultAssets, oldTokenAmount, 1e6, "New vault assets should match old token amount");
    }

    function test_fork_migrate_partial() public {
        uint256 oldShares = oldVault.balanceOf(USER);
        uint256 halfShares = oldShares / 2;

        vm.startPrank(USER);
        IERC20(OLD_VAULT).approve(address(zap), halfShares);
        uint256 newShares = zap.migrate(halfShares);
        vm.stopPrank();

        // Still has remaining old vault shares
        assertApproxEqAbs(oldVault.balanceOf(USER), oldShares - halfShares, 1);

        // Got new vault shares
        assertGt(newShares, 0);
    }

    function test_fork_constructorApprovals() public view {
        assertEq(
            IERC20(OLD_TOKEN).allowance(address(zap), WCHAN_ADDR),
            type(uint256).max,
            "OLD_TOKEN should be approved to WCHAN"
        );
        assertEq(
            IERC20(WCHAN_ADDR).allowance(address(zap), NEW_VAULT),
            type(uint256).max,
            "WCHAN should be approved to new vault"
        );
    }
}
