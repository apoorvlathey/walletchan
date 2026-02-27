// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Permit, ERC20, Nonces} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC3009} from "../utils/token/ERC3009.sol";

/**
 * @title WCHANTestnet
 * @dev Testnet version of WCHAN where OLD_TOKEN is set via constructor instead of being a constant.
 *      Identical logic to WCHAN otherwise — mints total supply to contract, uses transfers for wrap/unwrap.
 */
contract WCHANTestnet is ERC20, ERC20Permit, ERC20Votes, ERC3009, IERC165 {

    /// @notice Address of the legacy token (set at deploy time)
    address public immutable OLD_TOKEN;

    /// @notice Total supply of the old token
    uint256 public constant TOTAL_SUPPLY = 100_000_000_000 ether; // 100 Billion

    string internal _tokenURI;

    event Wrap(address indexed sender, uint256 amount);
    event UnWrap(address indexed sender, uint256 amount);

    constructor(
        string memory tokenURI_,
        address oldToken_
    ) ERC20("WalletChan", "WCHAN") ERC20Permit("WalletChan") {
        _tokenURI = tokenURI_;
        OLD_TOKEN = oldToken_;
        _mint(address(this), TOTAL_SUPPLY);
    }

    // =====================================================
    //                  Wrap / Unwrap
    // =====================================================

    function wrap(uint256 amount_) external {
        _transfer(address(this), msg.sender, amount_);
        emit Wrap(msg.sender, amount_);
        SafeERC20.safeTransferFrom(IERC20(OLD_TOKEN), msg.sender, address(this), amount_);
    }

    function unwrap(uint256 amount_) external {
        _transfer(msg.sender, address(this), amount_);
        SafeERC20.safeTransfer(IERC20(OLD_TOKEN), msg.sender, amount_);
        emit UnWrap(msg.sender, amount_);
    }

    // =====================================================
    //                    Metadata
    // =====================================================

    function tokenURI() external view returns (string memory) {
        return _tokenURI;
    }

    function contractURI() external view returns (string memory) {
        return _tokenURI;
    }

    /// @notice ERC-165 interface detection
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId || // 0x01ffc9a7
            interfaceId == 0xe8a3d485 ||                 // ERC-7572 contractURI()
            interfaceId == 0x3c130d90;                   // tokenURI()
    }

    // =====================================================
    //                    ERC-3009
    // =====================================================

    function transferWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    }

    function transferWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        bytes memory signature
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
    }

    function receiveWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        _receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    }

    function receiveWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        bytes memory signature
    ) external {
        _receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
    }

    function cancelAuthorization(
        address authorizer, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        _cancelAuthorization(authorizer, nonce, v, r, s);
    }

    function cancelAuthorization(
        address authorizer, bytes32 nonce,
        bytes memory signature
    ) external {
        _cancelAuthorization(authorizer, nonce, signature);
    }

    // =====================================================
    //   Overrides (resolve diamond inheritance conflicts)
    // =====================================================

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public view override(ERC20Permit, Nonces) returns (uint256)
    {
        return super.nonces(owner);
    }

    // =====================================================
    //       ERC20Votes: Timestamp-based clock (ERC-6372)
    // =====================================================

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }
}
