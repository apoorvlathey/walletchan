// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {MockOldToken} from "@src/mocks/MockOldToken.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * cd apps/contracts && source .env && forge script script/00_DeployMockOldToken.s.sol:DeployMockOldToken --broadcast --verify -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
 */

contract DeployMockOldToken is DeployHelper {
    function run() external {
        _loadAddresses();

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));
        MockOldToken token = new MockOldToken();
        vm.stopBroadcast();

        _saveAddress("OLD_TOKEN", address(token));
        console.log("MockOldToken deployed at:", address(token));
    }
}
