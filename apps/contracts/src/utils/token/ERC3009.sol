// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ERC-3009: Transfer With Authorization
 * @notice Provide internal implementation for gas-abstracted transfers
 * @dev Adapted from Circle's FiatTokenV2 EIP-3009 implementation.
 * Contracts that inherit from this must wrap these with publicly
 * accessible functions, optionally adding modifiers where necessary.
 */
abstract contract ERC3009 is ERC20, EIP712 {
    // keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;

    // keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    // keccak256("CancelAuthorization(address authorizer,bytes32 nonce)")
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    /**
     * @dev authorizer address => nonce => bool (true if nonce is used)
     */
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(
        address indexed authorizer,
        bytes32 indexed nonce
    );

    /**
     * @notice Returns the state of an authorization
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @return True if the nonce is used
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Execute a transfer with a signed authorization (v, r, s)
     */
    function _transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        _transferWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            abi.encodePacked(r, s, v)
        );
    }

    /**
     * @notice Execute a transfer with a signed authorization
     * @dev EOA wallet signatures should be packed in the order of r, s, v.
     */
    function _transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(
                abi.encode(
                    TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            ),
            signature
        );

        _markAuthorizationAsUsed(from, nonce);
        _transfer(from, to, value);
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer (v, r, s)
     * @dev Has an additional check to ensure that the payee's address
     * matches the caller to prevent front-running attacks.
     */
    function _receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        _receiveWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            abi.encodePacked(r, s, v)
        );
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev Has an additional check to ensure that the payee's address
     * matches the caller to prevent front-running attacks.
     * EOA wallet signatures should be packed in the order of r, s, v.
     */
    function _receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        require(to == msg.sender, "ERC3009: caller must be the payee");
        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(
                abi.encode(
                    RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            ),
            signature
        );

        _markAuthorizationAsUsed(from, nonce);
        _transfer(from, to, value);
    }

    /**
     * @notice Attempt to cancel an authorization (v, r, s)
     */
    function _cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        _cancelAuthorization(authorizer, nonce, abi.encodePacked(r, s, v));
    }

    /**
     * @notice Attempt to cancel an authorization
     * @dev EOA wallet signatures should be packed in the order of r, s, v.
     */
    function _cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        _requireUnusedAuthorization(authorizer, nonce);
        _requireValidSignature(
            authorizer,
            keccak256(
                abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce)
            ),
            signature
        );

        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    function _requireValidSignature(
        address signer,
        bytes32 dataHash,
        bytes memory signature
    ) private view {
        require(
            SignatureChecker.isValidSignatureNow(
                signer,
                MessageHashUtils.toTypedDataHash(
                    _domainSeparatorV4(),
                    dataHash
                ),
                signature
            ),
            "ERC3009: invalid signature"
        );
    }

    function _requireUnusedAuthorization(
        address authorizer,
        bytes32 nonce
    ) private view {
        require(
            !_authorizationStates[authorizer][nonce],
            "ERC3009: authorization is used or canceled"
        );
    }

    function _requireValidAuthorization(
        address authorizer,
        bytes32 nonce,
        uint256 validAfter,
        uint256 validBefore
    ) private view {
        require(
            block.timestamp > validAfter,
            "ERC3009: authorization is not yet valid"
        );
        require(
            block.timestamp < validBefore,
            "ERC3009: authorization is expired"
        );
        _requireUnusedAuthorization(authorizer, nonce);
    }

    function _markAuthorizationAsUsed(
        address authorizer,
        bytes32 nonce
    ) private {
        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }
}
