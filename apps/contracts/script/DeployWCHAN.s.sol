// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {WCHAN} from "@src/WCHAN.sol";

/**
 * cd apps/contracts && source .env && forge script --chain base script/DeployWCHAN.s.sol:DeployWCHAN --rpc-url $BASE_RPC_URL --broadcast --verify -vvvv
 */

contract DeployWCHAN is Script {
    // FIXME: add ipfs hash
    string constant TOKEN_URI = "ipfs://";

    function run() external {
        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));
        WCHAN token = new WCHAN(TOKEN_URI);
        vm.stopBroadcast();

        console.log("WCHAN deployed at:", address(token));
    }
}
