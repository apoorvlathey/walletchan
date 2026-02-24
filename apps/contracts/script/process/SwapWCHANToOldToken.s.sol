// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SwapViaWrapHook} from "../common/SwapViaWrapHook.s.sol";

/**
 * Swaps WCHAN → OLD_TOKEN (unwrap) via UniversalRouter + WCHANWrapHook (1:1, fee=0).
 *
 * Required in addresses.json: OLD_TOKEN, WCHAN, WCHAN_WRAP_HOOK, UNIVERSAL_ROUTER
 *
 * Dry-run:
 *   cd apps/contracts && source .env && forge script script/process/SwapWCHANToOldToken.s.sol:SwapWCHANToOldToken -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
 *
 * Broadcast:
 *   cd apps/contracts && source .env && forge script script/process/SwapWCHANToOldToken.s.sol:SwapWCHANToOldToken --broadcast -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
 */
contract SwapWCHANToOldToken is SwapViaWrapHook {
    function _getTokens(address oldToken, address wchan)
        internal
        pure
        override
        returns (address tokenIn, address tokenOut)
    {
        return (wchan, oldToken);
    }
}
