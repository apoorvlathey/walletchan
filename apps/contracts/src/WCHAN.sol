// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 *
 *    ww      ww  cccccc  hh   hh   aaaa   nn   nn
 *    ww      ww cc       hh   hh  aa  aa  nnn  nn
 *    ww  ww  ww cc       hhhhhhh  aaaaaa  nn n nn
 *     ww ww ww  cc       hh   hh  aa  aa  nn  nnn
 *      ww  ww    cccccc  hh   hh  aa  aa  nn   nn
 *
 *            -- $WCHAN (WalletChan) --
 *
 */

import {ERC20Permit, ERC20, Nonces} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC3009} from "./utils/token/ERC3009.sol";

/**
 * @title WCHAN (WalletChan)
 * @dev Users wrap their OLD_TOKEN 1:1 into WCHAN and can unwrap back at any time.
 *
 * Features:
 *  - ERC-20 with burn support (ERC20Burnable)
 *  - Gasless approvals via ERC-2612 Permit (ERC20Permit)
 *  - Gasless transfers via ERC-3009 TransferWithAuthorization
 *  - On-chain governance via ERC20Votes (timestamp-based clock)
 *  - ERC-7572 contract-level metadata
 */
contract WCHAN is ERC20, ERC20Permit, ERC20Votes, ERC20Burnable, ERC3009 {

    /// @notice Address of the legacy token on Base
    address public constant OLD_TOKEN = 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07;

    /// @dev Token and contract metadata URI (ERC-7572)
    string internal _tokenURI;

    /// @notice Emitted when a user wraps OLD_TOKEN into WCHAN
    event Wrap(address indexed sender, uint256 amount);

    /// @notice Emitted when a user unwraps WCHAN back into OLD_TOKEN
    event UnWrap(address indexed sender, uint256 amount);

    /// @param tokenURI_ Metadata URI for both tokenURI() and contractURI()
    constructor (
        string memory tokenURI_
    ) ERC20("WalletChan", "WCHAN") ERC20Permit("WalletChan") {
        _tokenURI = tokenURI_;
    }

    /**
     * =====================================================
     *                  Wrap / Unwrap
     * =====================================================
     */

    /// @notice Wrap OLD_TOKEN into WCHAN at a 1:1 ratio
    /// @dev Caller must have approved this contract to spend `amount_` of OLD_TOKEN
    /// @param amount_ Amount of OLD_TOKEN to wrap
    function wrap(uint256 amount_) external {
        // Effects before interactions (CEI)
        _mint(msg.sender, amount_);
        emit Wrap(msg.sender, amount_);
        // Interaction — reverts the entire tx (including mint) on failure
        SafeERC20.safeTransferFrom(IERC20(OLD_TOKEN), msg.sender, address(this), amount_);
    }

    /// @notice Unwrap WCHAN back into OLD_TOKEN at a 1:1 ratio
    /// @dev Burns the caller's WCHAN, then transfers OLD_TOKEN back
    /// @param amount_ Amount of WCHAN to unwrap
    function unwrap(uint256 amount_) external {
        _burn(msg.sender, amount_);
        SafeERC20.safeTransfer(IERC20(OLD_TOKEN), msg.sender, amount_);
        emit UnWrap(msg.sender, amount_);
    }

    /**
     * =====================================================
     *                    Metadata
     * =====================================================
     */

    /// @notice Returns the token metadata URI
    function tokenURI() external view returns (string memory) {
        return _tokenURI;
    }

    /// @notice Returns the contract-level metadata URI (ERC-7572)
    function contractURI() external view returns (string memory) {
        return _tokenURI;
    }

    /**
     * =====================================================
     *                    ERC-3009
     * =====================================================
     */

    /// @notice Execute a transfer with a signed authorization (v, r, s)
    /// @dev Anyone can submit this (e.g. a relayer). See EIP-3009.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    }

    /// @notice Execute a transfer with a signed authorization (bytes signature)
    /// @dev EOA signatures should be packed as `abi.encodePacked(r, s, v)`
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        _transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
    }

    /// @notice Receive a transfer with a signed authorization (v, r, s)
    /// @dev Must be called by the payee (`to`). Prevents front-running.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    }

    /// @notice Receive a transfer with a signed authorization (bytes signature)
    /// @dev Must be called by the payee (`to`). Prevents front-running.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        _receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
    }

    /// @notice Cancel an authorization before it is used (v, r, s)
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _cancelAuthorization(authorizer, nonce, v, r, s);
    }

    /// @notice Cancel an authorization before it is used (bytes signature)
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes memory signature
    ) external {
        _cancelAuthorization(authorizer, nonce, signature);
    }

    /**
     * =====================================================
     *   Overrides (resolve diamond inheritance conflicts)
     * =====================================================
     */

    /// @dev Routes through ERC20Votes to track voting power on transfers/mints/burns
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    /// @dev Resolves nonce conflict between ERC20Permit and Nonces
    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * =====================================================
     *       ERC20Votes: Timestamp-based clock (ERC-6372)
     * =====================================================
     */

    /// @dev Uses block.timestamp instead of block.number for vote checkpointing
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /// @dev Machine-readable clock mode descriptor per ERC-6372
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }
}
