// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WCHAN} from "../src/WCHAN.sol";
import {ERC3009} from "../src/utils/token/ERC3009.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// @dev Minimal ERC20 mock with public mint, deployed at OLD_TOKEN address
contract ERC20Mock is ERC20 {
    constructor() ERC20("OldWalletChan", "OLDWCHAN") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract WCHANBaseTest is Test {
    WCHAN public token;
    ERC20Mock public oldToken;

    // Test accounts
    uint256 internal alicePk = 0xa11ce;
    uint256 internal bobPk = 0xb0b;
    uint256 internal carolPk = 0xca201;
    address internal alice;
    address internal bob;
    address internal carol;
    address internal relayer;

    // EIP-712
    bytes32 internal constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal DOMAIN_SEPARATOR;

    // ERC-3009 typehashes
    bytes32 internal constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;
    bytes32 internal constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;
    bytes32 internal constant CANCEL_AUTHORIZATION_TYPEHASH =
        0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    // ERC-2612 permit typehash
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public virtual {
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        carol = vm.addr(carolPk);
        relayer = makeAddr("relayer");

        // Deploy ERC20Mock and etch its code at the OLD_TOKEN address
        ERC20Mock mockImpl = new ERC20Mock();
        address oldTokenAddr = 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07;
        vm.etch(oldTokenAddr, address(mockImpl).code);
        oldToken = ERC20Mock(oldTokenAddr);

        token = new WCHAN("https://example.com/token.json");

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                TYPE_HASH,
                keccak256("WalletChan"),
                keccak256("1"),
                block.chainid,
                address(token)
            )
        );
    }

    // ───────── Helpers ─────────

    /// @dev Mint OLD_TOKEN, approve WCHAN, and wrap to get WCHAN balance
    function _wrapTokens(address user, uint256 amount) internal {
        oldToken.mint(user, amount);
        vm.startPrank(user);
        oldToken.approve(address(token), amount);
        token.wrap(amount);
        vm.stopPrank();
    }

    // ───────── Signature helpers ─────────

    function _signTransferAuth(
        uint256 signerPk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        (v, r, s) = vm.sign(signerPk, digest);
    }

    function _signReceiveAuth(
        uint256 signerPk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        (v, r, s) = vm.sign(signerPk, digest);
    }

    function _signCancelAuth(
        uint256 signerPk,
        address authorizer,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        (v, r, s) = vm.sign(signerPk, digest);
    }

    function _signPermit(
        uint256 signerPk,
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        (v, r, s) = vm.sign(signerPk, digest);
    }
}

// ═══════════════════════════════════════════════════
//                    METADATA
// ═══════════════════════════════════════════════════

contract WCHANMetadataTest is WCHANBaseTest {
    function test_name() public view {
        assertEq(token.name(), "WalletChan");
    }

    function test_symbol() public view {
        assertEq(token.symbol(), "WCHAN");
    }

    function test_decimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_initialSupplyIsTotalSupply() public view {
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(token.balanceOf(address(token)), token.TOTAL_SUPPLY());
    }

    function test_oldTokenAddress() public view {
        assertEq(token.OLD_TOKEN(), 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07);
    }

    function test_tokenURI() public view {
        assertEq(token.tokenURI(), "https://example.com/token.json");
    }

    function test_contractURI() public view {
        assertEq(token.contractURI(), "https://example.com/token.json");
    }

    function test_tokenURI_and_contractURI_match() public view {
        assertEq(token.tokenURI(), token.contractURI());
    }

    function test_supportsInterface_ERC165() public view {
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
    }

    function test_supportsInterface_ERC7572() public view {
        assertTrue(token.supportsInterface(WCHAN.contractURI.selector));
    }

    function test_supportsInterface_tokenURI() public view {
        assertTrue(token.supportsInterface(WCHAN.tokenURI.selector));
    }

    function test_supportsInterface_unsupported() public view {
        assertFalse(token.supportsInterface(0xffffffff));
        assertFalse(token.supportsInterface(0x00000000));
    }

    function test_domainSeparatorMatchesExpected() public view {
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            ,
        ) = token.eip712Domain();
        assertEq(name, "WalletChan");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(verifyingContract, address(token));
    }
}

// ═══════════════════════════════════════════════════
//                 WRAP / UNWRAP
// ═══════════════════════════════════════════════════

contract WCHANWrapUnwrapTest is WCHANBaseTest {
    event Wrap(address indexed sender, uint256 amount);
    event UnWrap(address indexed sender, uint256 amount);

    function test_wrap(uint256 amount) public {
        amount = bound(amount, 1, 100_000_000e18);
        oldToken.mint(alice, amount);

        vm.startPrank(alice);
        oldToken.approve(address(token), amount);
        token.wrap(amount);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), amount);
        assertEq(oldToken.balanceOf(alice), 0);
        assertEq(oldToken.balanceOf(address(token)), amount);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function test_wrap_emitsEvent() public {
        oldToken.mint(alice, 100e18);
        vm.startPrank(alice);
        oldToken.approve(address(token), 100e18);

        vm.expectEmit(true, false, false, true);
        emit Wrap(alice, 100e18);
        token.wrap(100e18);
        vm.stopPrank();
    }

    function test_wrap_revert_noApproval() public {
        oldToken.mint(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert();
        token.wrap(100e18);
    }

    function test_wrap_revert_insufficientOldBalance() public {
        // Alice has no old tokens
        vm.startPrank(alice);
        oldToken.approve(address(token), 100e18);
        vm.expectRevert();
        token.wrap(100e18);
        vm.stopPrank();
    }

    function test_unwrap(uint256 amount) public {
        amount = bound(amount, 1, 100_000_000e18);
        _wrapTokens(alice, amount);

        vm.prank(alice);
        token.unwrap(amount);

        assertEq(token.balanceOf(alice), 0);
        assertEq(oldToken.balanceOf(alice), amount);
        assertEq(oldToken.balanceOf(address(token)), 0);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function test_unwrap_emitsEvent() public {
        _wrapTokens(alice, 100e18);

        vm.expectEmit(true, false, false, true);
        emit UnWrap(alice, 100e18);

        vm.prank(alice);
        token.unwrap(100e18);
    }

    function test_unwrap_revert_insufficientWCHAN() public {
        _wrapTokens(alice, 100e18);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 100e18, 101e18)
        );
        token.unwrap(101e18);
    }

    function test_unwrap_revert_noBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1)
        );
        token.unwrap(1);
    }

    function test_wrapThenUnwrap_isLossless(uint256 amount) public {
        amount = bound(amount, 1, 100_000_000e18);
        oldToken.mint(alice, amount);
        uint256 oldBalanceBefore = oldToken.balanceOf(alice);

        // Wrap
        vm.startPrank(alice);
        oldToken.approve(address(token), amount);
        token.wrap(amount);

        // Unwrap
        token.unwrap(amount);
        vm.stopPrank();

        assertEq(oldToken.balanceOf(alice), oldBalanceBefore);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function test_partialUnwrap(uint256 wrapAmount, uint256 unwrapAmount) public {
        wrapAmount = bound(wrapAmount, 2, 100_000_000e18);
        unwrapAmount = bound(unwrapAmount, 1, wrapAmount - 1);

        _wrapTokens(alice, wrapAmount);

        vm.prank(alice);
        token.unwrap(unwrapAmount);

        assertEq(token.balanceOf(alice), wrapAmount - unwrapAmount);
        assertEq(oldToken.balanceOf(alice), unwrapAmount);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function test_multipleUsersWrapAndUnwrap() public {
        _wrapTokens(alice, 300e18);
        _wrapTokens(bob, 200e18);

        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(oldToken.balanceOf(address(token)), 500e18);

        vm.prank(alice);
        token.unwrap(100e18);

        assertEq(token.balanceOf(alice), 200e18);
        assertEq(oldToken.balanceOf(alice), 100e18);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(oldToken.balanceOf(address(token)), 400e18);
    }

    function test_wrap_updatesVotingPower() public {
        oldToken.mint(alice, 500e18);

        vm.prank(alice);
        token.delegate(alice);

        vm.startPrank(alice);
        oldToken.approve(address(token), 500e18);
        token.wrap(500e18);
        vm.stopPrank();

        assertEq(token.getVotes(alice), 500e18);
    }

    function test_unwrap_updatesVotingPower() public {
        _wrapTokens(alice, 500e18);

        vm.prank(alice);
        token.delegate(alice);
        assertEq(token.getVotes(alice), 500e18);

        vm.prank(alice);
        token.unwrap(200e18);

        assertEq(token.getVotes(alice), 300e18);
    }

    function test_wrapZero() public {
        vm.startPrank(alice);
        oldToken.approve(address(token), 0);
        token.wrap(0);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function test_unwrapZero() public {
        vm.prank(alice);
        token.unwrap(0);

        assertEq(token.balanceOf(alice), 0);
    }
}

// ═══════════════════════════════════════════════════
//                  ERC-20 CORE
// ═══════════════════════════════════════════════════

contract WCHANERC20Test is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
    }

    function test_transfer(uint256 amount) public {
        amount = bound(amount, 0, 1000e18);
        vm.prank(alice);
        token.transfer(bob, amount);
        assertEq(token.balanceOf(bob), amount);
        assertEq(token.balanceOf(alice), 1000e18 - amount);
    }

    function test_transfer_revert_insufficientBalance(uint256 amount) public {
        amount = bound(amount, 1001e18, type(uint256).max);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 1000e18, amount)
        );
        token.transfer(bob, amount);
    }

    function test_approve_and_transferFrom(uint256 amount) public {
        amount = bound(amount, 0, 1000e18);
        vm.prank(alice);
        token.approve(bob, amount);
        assertEq(token.allowance(alice, bob), amount);

        vm.prank(bob);
        token.transferFrom(alice, bob, amount);
        assertEq(token.balanceOf(bob), amount);
    }

    function test_transferFrom_revert_insufficientAllowance(uint256 approved, uint256 amount) public {
        approved = bound(approved, 0, 999e18);
        amount = bound(amount, approved + 1, 1000e18);
        vm.prank(alice);
        token.approve(bob, approved);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, approved, amount)
        );
        token.transferFrom(alice, bob, amount);
    }

    function test_transfer_toZeroAddress_reverts() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        token.transfer(address(0), 1);
    }

    function test_unlimitedApproval_doesNotDecreaseOnTransfer() public {
        vm.prank(alice);
        token.approve(bob, type(uint256).max);

        vm.prank(bob);
        token.transferFrom(alice, bob, 100e18);

        assertEq(token.allowance(alice, bob), type(uint256).max);
    }
}

// ═══════════════════════════════════════════════════
//               ERC-2612 PERMIT
// ═══════════════════════════════════════════════════

contract WCHANPermitTest is WCHANBaseTest {
    function test_permit_setsAllowance(uint256 amount) public {
        amount = bound(amount, 1, type(uint256).max);
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(alicePk, alice, bob, amount, 0, deadline);

        token.permit(alice, bob, amount, deadline, v, r, s);
        assertEq(token.allowance(alice, bob), amount);
        assertEq(token.nonces(alice), 1);
    }

    function test_permit_revert_expiredDeadline() public {
        uint256 deadline = block.timestamp - 1;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(alicePk, alice, bob, 100e18, 0, deadline);

        vm.expectRevert();
        token.permit(alice, bob, 100e18, deadline, v, r, s);
    }

    function test_permit_revert_wrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        // Bob signs a permit for Alice's tokens — should fail
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(bobPk, alice, bob, 100e18, 0, deadline);

        vm.expectRevert();
        token.permit(alice, bob, 100e18, deadline, v, r, s);
    }

    function test_permit_revert_replayedNonce() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(alicePk, alice, bob, 100e18, 0, deadline);
        token.permit(alice, bob, 100e18, deadline, v, r, s);

        // Replay with same nonce (now expects nonce=1)
        vm.expectRevert();
        token.permit(alice, bob, 100e18, deadline, v, r, s);
    }
}

// ═══════════════════════════════════════════════════
//               ERC-20 VOTES
// ═══════════════════════════════════════════════════

contract WCHANVotesTest is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
    }

    function test_clockMode_isTimestamp() public view {
        assertEq(token.CLOCK_MODE(), "mode=timestamp");
        assertEq(token.clock(), uint48(block.timestamp));
    }

    function test_delegate_self() public {
        vm.prank(alice);
        token.delegate(alice);
        assertEq(token.getVotes(alice), 1000e18);
        assertEq(token.delegates(alice), alice);
    }

    function test_delegate_other() public {
        vm.prank(alice);
        token.delegate(bob);
        assertEq(token.getVotes(bob), 1000e18);
        assertEq(token.getVotes(alice), 0);
    }

    function test_votingPower_notActiveUntilDelegated() public view {
        // No delegation yet — voting power should be 0
        assertEq(token.getVotes(alice), 0);
    }

    function test_transferUpdatesVotingPower(uint256 amount) public {
        amount = bound(amount, 1, 1000e18);

        vm.prank(alice);
        token.delegate(alice);

        vm.prank(alice);
        token.transfer(bob, amount);

        // Alice's votes decrease, bob has no votes (not delegated)
        assertEq(token.getVotes(alice), 1000e18 - amount);
        assertEq(token.getVotes(bob), 0);

        // Bob delegates, now gets votes
        vm.prank(bob);
        token.delegate(bob);
        assertEq(token.getVotes(bob), amount);
    }

    function test_pastVotes_checkpoint() public {
        vm.prank(alice);
        token.delegate(alice);

        uint256 t1 = block.timestamp;

        // Advance time
        vm.warp(t1 + 100);

        // Transfer some away
        vm.prank(alice);
        token.transfer(bob, 300e18);

        // Past votes at t1 should still be 1000e18
        assertEq(token.getPastVotes(alice, t1), 1000e18);
        // Current votes should be 700e18
        assertEq(token.getVotes(alice), 700e18);
    }
}

// ═══════════════════════════════════════════════════
//    ERC-3009: TRANSFER WITH AUTHORIZATION
// ═══════════════════════════════════════════════════

contract WCHANERC3009TransferTest is WCHANBaseTest {
    uint256 internal constant MINT_AMOUNT = 1000e18;

    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, MINT_AMOUNT);
        // Start at a non-zero timestamp so validAfter=0 works
        vm.warp(1000);
    }

    function test_transferWithAuthorization_vrs(uint256 amount) public {
        amount = bound(amount, 1, MINT_AMOUNT);
        bytes32 nonce = keccak256("nonce1");
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, amount, validAfter, validBefore, nonce
        );

        // Anyone can submit (relayer)
        vm.prank(relayer);
        token.transferWithAuthorization(alice, bob, amount, validAfter, validBefore, nonce, v, r, s);

        assertEq(token.balanceOf(bob), amount);
        assertEq(token.balanceOf(alice), MINT_AMOUNT - amount);
        assertTrue(token.authorizationState(alice, nonce));
    }

    function test_transferWithAuthorization_bytesSignature(uint256 amount) public {
        amount = bound(amount, 1, MINT_AMOUNT);
        bytes32 nonce = keccak256("nonce-bytes");
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, amount, validAfter, validBefore, nonce
        );

        vm.prank(relayer);
        token.transferWithAuthorization(
            alice, bob, amount, validAfter, validBefore, nonce, abi.encodePacked(r, s, v)
        );

        assertEq(token.balanceOf(bob), amount);
    }

    function test_transferWithAuthorization_emitsEvent() public {
        bytes32 nonce = keccak256("nonce-event");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        vm.expectEmit(true, true, false, false);
        emit ERC3009.AuthorizationUsed(alice, nonce);

        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_replayNonce() public {
        bytes32 nonce = keccak256("replay");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);

        // Same nonce — should revert
        vm.expectRevert("ERC3009: authorization is used or canceled");
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_notYetValid() public {
        bytes32 nonce = keccak256("early");
        uint256 validAfter = block.timestamp + 1 hours;
        uint256 validBefore = block.timestamp + 2 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, validAfter, validBefore, nonce
        );

        vm.expectRevert("ERC3009: authorization is not yet valid");
        token.transferWithAuthorization(alice, bob, 100e18, validAfter, validBefore, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_expired() public {
        bytes32 nonce = keccak256("expired");
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp - 1;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, validAfter, validBefore, nonce
        );

        vm.expectRevert("ERC3009: authorization is expired");
        token.transferWithAuthorization(alice, bob, 100e18, validAfter, validBefore, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_wrongSigner() public {
        bytes32 nonce = keccak256("wrongsigner");
        // Bob signs an auth for Alice's tokens
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            bobPk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        vm.expectRevert("ERC3009: invalid signature");
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_tamperedAmount() public {
        bytes32 nonce = keccak256("tamper");
        // Sign for 100
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Submit for 200
        vm.expectRevert("ERC3009: invalid signature");
        token.transferWithAuthorization(alice, bob, 200e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_tamperedRecipient() public {
        bytes32 nonce = keccak256("tamper-to");
        // Sign for bob
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Submit for carol
        vm.expectRevert("ERC3009: invalid signature");
        token.transferWithAuthorization(alice, carol, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_transferWithAuthorization_revert_insufficientBalance() public {
        bytes32 nonce = keccak256("toomuch");
        uint256 tooMuch = MINT_AMOUNT + 1;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, tooMuch, 0, block.timestamp + 1 hours, nonce
        );

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, MINT_AMOUNT, tooMuch)
        );
        token.transferWithAuthorization(alice, bob, tooMuch, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    // Fuzz: any valid time window + amount should work
    function test_fuzz_transferWithAuthorization(
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) public {
        amount = bound(amount, 1, MINT_AMOUNT);
        validAfter = bound(validAfter, 0, block.timestamp - 1);
        validBefore = bound(validBefore, block.timestamp + 1, type(uint256).max);

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, amount, validAfter, validBefore, nonce
        );

        token.transferWithAuthorization(alice, bob, amount, validAfter, validBefore, nonce, v, r, s);

        assertEq(token.balanceOf(bob), amount);
        assertTrue(token.authorizationState(alice, nonce));
    }
}

// ═══════════════════════════════════════════════════
//    ERC-3009: RECEIVE WITH AUTHORIZATION
// ═══════════════════════════════════════════════════

contract WCHANERC3009ReceiveTest is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
        vm.warp(1000);
    }

    function test_receiveWithAuthorization_vrs() public {
        bytes32 nonce = keccak256("recv1");
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Must be called by the payee (bob)
        vm.prank(bob);
        token.receiveWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);

        assertEq(token.balanceOf(bob), 100e18);
    }

    function test_receiveWithAuthorization_bytesSignature() public {
        bytes32 nonce = keccak256("recv-bytes");
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, 50e18, 0, block.timestamp + 1 hours, nonce
        );

        vm.prank(bob);
        token.receiveWithAuthorization(
            alice, bob, 50e18, 0, block.timestamp + 1 hours, nonce, abi.encodePacked(r, s, v)
        );

        assertEq(token.balanceOf(bob), 50e18);
    }

    function test_receiveWithAuthorization_revert_callerNotPayee() public {
        bytes32 nonce = keccak256("frontrun");
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Carol tries to call it (not bob)
        vm.prank(carol);
        vm.expectRevert("ERC3009: caller must be the payee");
        token.receiveWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_receiveWithAuthorization_revert_relayerCannotCall() public {
        bytes32 nonce = keccak256("relayer-recv");
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Relayer tries to submit — should fail (only payee can call)
        vm.prank(relayer);
        vm.expectRevert("ERC3009: caller must be the payee");
        token.receiveWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_fuzz_receiveWithAuthorization(
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) public {
        amount = bound(amount, 1, 1000e18);
        validAfter = bound(validAfter, 0, block.timestamp - 1);
        validBefore = bound(validBefore, block.timestamp + 1, type(uint256).max);

        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, amount, validAfter, validBefore, nonce
        );

        vm.prank(bob);
        token.receiveWithAuthorization(alice, bob, amount, validAfter, validBefore, nonce, v, r, s);

        assertEq(token.balanceOf(bob), amount);
    }
}

// ═══════════════════════════════════════════════════
//    ERC-3009: CANCEL AUTHORIZATION
// ═══════════════════════════════════════════════════

contract WCHANERC3009CancelTest is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
        vm.warp(1000);
    }

    function test_cancelAuthorization_vrs() public {
        bytes32 nonce = keccak256("cancel1");

        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(alicePk, alice, nonce);
        token.cancelAuthorization(alice, nonce, v, r, s);

        assertTrue(token.authorizationState(alice, nonce));
    }

    function test_cancelAuthorization_bytesSignature() public {
        bytes32 nonce = keccak256("cancel-bytes");

        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(alicePk, alice, nonce);
        token.cancelAuthorization(alice, nonce, abi.encodePacked(r, s, v));

        assertTrue(token.authorizationState(alice, nonce));
    }

    function test_cancelAuthorization_emitsEvent() public {
        bytes32 nonce = keccak256("cancel-event");
        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(alicePk, alice, nonce);

        vm.expectEmit(true, true, false, false);
        emit ERC3009.AuthorizationCanceled(alice, nonce);

        token.cancelAuthorization(alice, nonce, v, r, s);
    }

    function test_cancelAuthorization_preventsTransfer() public {
        bytes32 nonce = keccak256("cancel-then-transfer");

        // Cancel first
        (uint8 cv, bytes32 cr, bytes32 cs) = _signCancelAuth(alicePk, alice, nonce);
        token.cancelAuthorization(alice, nonce, cv, cr, cs);

        // Now try to use the same nonce for a transfer
        (uint8 tv, bytes32 tr, bytes32 ts) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        vm.expectRevert("ERC3009: authorization is used or canceled");
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, tv, tr, ts);
    }

    function test_cancelAuthorization_revert_alreadyCanceled() public {
        bytes32 nonce = keccak256("double-cancel");

        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(alicePk, alice, nonce);
        token.cancelAuthorization(alice, nonce, v, r, s);

        vm.expectRevert("ERC3009: authorization is used or canceled");
        token.cancelAuthorization(alice, nonce, v, r, s);
    }

    function test_cancelAuthorization_revert_wrongSigner() public {
        bytes32 nonce = keccak256("wrong-cancel");

        // Bob tries to cancel Alice's nonce
        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(bobPk, alice, nonce);

        vm.expectRevert("ERC3009: invalid signature");
        token.cancelAuthorization(alice, nonce, v, r, s);
    }

    function test_fuzz_cancelAuthorization(bytes32 nonce) public {
        (uint8 v, bytes32 r, bytes32 s) = _signCancelAuth(alicePk, alice, nonce);
        token.cancelAuthorization(alice, nonce, v, r, s);
        assertTrue(token.authorizationState(alice, nonce));
    }
}

// ═══════════════════════════════════════════════════
//    ERC-3009: SECURITY / EDGE CASES
// ═══════════════════════════════════════════════════

contract WCHANERC3009SecurityTest is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
        vm.warp(1000);
    }

    /// @dev Transfer and receive use different typehashes — a transfer sig
    ///      should not work as a receive and vice versa.
    function test_crossFunctionReplay_transferSigAsReceive() public {
        bytes32 nonce = keccak256("cross1");
        // Sign a transferWithAuthorization
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Try to use it as receiveWithAuthorization
        vm.prank(bob);
        vm.expectRevert("ERC3009: invalid signature");
        token.receiveWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    function test_crossFunctionReplay_receiveSigAsTransfer() public {
        bytes32 nonce = keccak256("cross2");
        // Sign a receiveWithAuthorization
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Try to use it as transferWithAuthorization
        vm.expectRevert("ERC3009: invalid signature");
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    /// @dev Nonce is shared across transfer/receive/cancel — using one blocks the others
    function test_nonceSharedAcrossFunctions() public {
        bytes32 nonce = keccak256("shared");

        // Use nonce via transferWithAuthorization
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);

        // Try to cancel the same nonce
        (uint8 cv, bytes32 cr, bytes32 cs) = _signCancelAuth(alicePk, alice, nonce);
        vm.expectRevert("ERC3009: authorization is used or canceled");
        token.cancelAuthorization(alice, nonce, cv, cr, cs);
    }

    /// @dev Each authorizer has independent nonce space
    function test_nonceIsolation_differentAuthorizers() public {
        _wrapTokens(bob, 500e18);
        bytes32 nonce = keccak256("same-nonce");

        // Alice uses the nonce
        (uint8 v1, bytes32 r1, bytes32 s1) = _signTransferAuth(
            alicePk, alice, carol, 50e18, 0, block.timestamp + 1 hours, nonce
        );
        token.transferWithAuthorization(alice, carol, 50e18, 0, block.timestamp + 1 hours, nonce, v1, r1, s1);

        // Bob can still use the same nonce value
        (uint8 v2, bytes32 r2, bytes32 s2) = _signTransferAuth(
            bobPk, bob, carol, 50e18, 0, block.timestamp + 1 hours, nonce
        );
        token.transferWithAuthorization(bob, carol, 50e18, 0, block.timestamp + 1 hours, nonce, v2, r2, s2);

        assertEq(token.balanceOf(carol), 100e18);
    }

    /// @dev Exact boundary: validAfter = block.timestamp should fail (requires strictly greater)
    function test_validAfter_exactBoundary() public {
        bytes32 nonce = keccak256("boundary-after");
        uint256 validAfter = block.timestamp; // block.timestamp > validAfter is false when equal

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, validAfter, block.timestamp + 1 hours, nonce
        );

        vm.expectRevert("ERC3009: authorization is not yet valid");
        token.transferWithAuthorization(alice, bob, 100e18, validAfter, block.timestamp + 1 hours, nonce, v, r, s);
    }

    /// @dev Exact boundary: validBefore = block.timestamp should fail (requires strictly less)
    function test_validBefore_exactBoundary() public {
        bytes32 nonce = keccak256("boundary-before");
        uint256 validBefore = block.timestamp;

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, validBefore, nonce
        );

        vm.expectRevert("ERC3009: authorization is expired");
        token.transferWithAuthorization(alice, bob, 100e18, 0, validBefore, nonce, v, r, s);
    }

    /// @dev Zero-value transfer should work
    function test_transferWithAuthorization_zeroAmount() public {
        bytes32 nonce = keccak256("zero");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 0, 0, block.timestamp + 1 hours, nonce
        );

        token.transferWithAuthorization(alice, bob, 0, 0, block.timestamp + 1 hours, nonce, v, r, s);

        assertEq(token.balanceOf(bob), 0);
        assertTrue(token.authorizationState(alice, nonce));
    }

    /// @dev Authorization should be bound to this specific chain + contract (domain separator)
    function test_domainSeparator_changesWithChainId() public {
        bytes32 nonce = keccak256("chain");
        // Sign on current chain
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce
        );

        // Simulate fork — different chain id
        vm.chainId(999);

        vm.expectRevert("ERC3009: invalid signature");
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    /// @dev Fuzz: random invalid signatures should always revert
    function test_fuzz_randomSignature_reverts(
        bytes32 r,
        bytes32 s,
        uint8 v
    ) public {
        bytes32 nonce = keccak256("fuzz-invalid");

        // Bound v to valid values to avoid ecrecover returning address(0) for trivial reasons
        v = uint8(bound(uint256(v), 27, 28));

        // Random r,s are overwhelmingly unlikely to be valid
        vm.expectRevert();
        token.transferWithAuthorization(alice, bob, 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }

    /// @dev ERC3009 transfer should update ERC20Votes checkpoints
    function test_transferWithAuth_updatesVotingPower() public {
        vm.prank(alice);
        token.delegate(alice);
        vm.prank(bob);
        token.delegate(bob);

        assertEq(token.getVotes(alice), 1000e18);

        bytes32 nonce = keccak256("votes");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, bob, 400e18, 0, block.timestamp + 1 hours, nonce
        );

        token.transferWithAuthorization(alice, bob, 400e18, 0, block.timestamp + 1 hours, nonce, v, r, s);

        assertEq(token.getVotes(alice), 600e18);
        assertEq(token.getVotes(bob), 400e18);
    }

    /// @dev transferWithAuthorization to address(0) should revert via ERC20
    function test_transferWithAuthorization_revert_toZeroAddress() public {
        bytes32 nonce = keccak256("zero-addr");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            alicePk, alice, address(0), 100e18, 0, block.timestamp + 1 hours, nonce
        );

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        token.transferWithAuthorization(alice, address(0), 100e18, 0, block.timestamp + 1 hours, nonce, v, r, s);
    }
}

// ═══════════════════════════════════════════════════
//    PERMIT → TRANSFER_FROM END-TO-END
// ═══════════════════════════════════════════════════

contract WCHANPermitTransferFromTest is WCHANBaseTest {
    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
    }

    /// @dev Full gasless flow: permit sets allowance, then bob calls transferFrom
    function test_permitThenTransferFrom(uint256 amount) public {
        amount = bound(amount, 1, 1000e18);
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(alicePk, alice, bob, amount, 0, deadline);

        // Anyone can submit the permit (gasless for alice)
        vm.prank(relayer);
        token.permit(alice, bob, amount, deadline, v, r, s);

        assertEq(token.allowance(alice, bob), amount);

        // Bob spends the allowance
        vm.prank(bob);
        token.transferFrom(alice, bob, amount);

        assertEq(token.balanceOf(bob), amount);
        assertEq(token.balanceOf(alice), 1000e18 - amount);
    }

    /// @dev Permit → partial transferFrom → another transferFrom uses remaining allowance
    function test_permitThenPartialTransfers() public {
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(alicePk, alice, bob, 500e18, 0, deadline);
        token.permit(alice, bob, 500e18, deadline, v, r, s);

        vm.prank(bob);
        token.transferFrom(alice, bob, 200e18);
        assertEq(token.allowance(alice, bob), 300e18);

        vm.prank(bob);
        token.transferFrom(alice, bob, 300e18);
        assertEq(token.allowance(alice, bob), 0);
        assertEq(token.balanceOf(bob), 500e18);
    }
}

// ═══════════════════════════════════════════════════
//    DELEGATE BY SIG (ERC20Votes)
// ═══════════════════════════════════════════════════

contract WCHANDelegateBySigTest is WCHANBaseTest {
    // ERC20Votes delegateBySig typehash
    bytes32 internal constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    function setUp() public override {
        super.setUp();
        _wrapTokens(alice, 1000e18);
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

    /// @dev Gasless delegation via signed message
    function test_delegateBySig() public {
        uint256 expiry = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 0, expiry);

        // Relayer submits on alice's behalf
        vm.prank(relayer);
        token.delegateBySig(bob, 0, expiry, v, r, s);

        assertEq(token.delegates(alice), bob);
        assertEq(token.getVotes(bob), 1000e18);
        assertEq(token.nonces(alice), 1);
    }

    /// @dev Expired delegation should revert
    function test_delegateBySig_revert_expired() public {
        uint256 expiry = block.timestamp - 1;

        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 0, expiry);

        vm.expectRevert();
        token.delegateBySig(bob, 0, expiry, v, r, s);
    }

    /// @dev Wrong nonce should revert
    function test_delegateBySig_revert_wrongNonce() public {
        uint256 expiry = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signDelegation(alicePk, bob, 999, expiry);

        vm.expectRevert();
        token.delegateBySig(bob, 999, expiry, v, r, s);
    }
}

// ═══════════════════════════════════════════════════
//    WRAP/UNWRAP EDGE CASES
// ═══════════════════════════════════════════════════

contract WCHANWrapEdgeCasesTest is WCHANBaseTest {
    /// @dev Multi-cycle: wrap → unwrap → wrap → unwrap should be lossless
    function test_multiCycle_wrapUnwrap(uint256 amount) public {
        amount = bound(amount, 1, 100_000_000e18);
        oldToken.mint(alice, amount);

        for (uint256 i = 0; i < 3; i++) {
            vm.startPrank(alice);
            oldToken.approve(address(token), amount);
            token.wrap(amount);
            assertEq(token.balanceOf(alice), amount);
            assertEq(oldToken.balanceOf(alice), 0);

            token.unwrap(amount);
            assertEq(token.balanceOf(alice), 0);
            assertEq(oldToken.balanceOf(alice), amount);
            vm.stopPrank();
        }

        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(oldToken.balanceOf(address(token)), 0);
    }


    /// @dev Transfer to self should work without changing balance
    function test_transfer_toSelf() public {
        _wrapTokens(alice, 500e18);

        vm.prank(alice);
        token.transfer(alice, 200e18);

        assertEq(token.balanceOf(alice), 500e18);
    }
}
