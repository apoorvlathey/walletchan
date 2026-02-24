// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {MockOldToken} from "@src/mocks/MockOldToken.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys MockOldToken and mints initial supply.
 *
 * Run:
 *   cd apps/contracts && source .env && forge script script/00_testnet_DeployMockOldToken.s.sol:DeployMockOldToken --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract DeployMockOldToken is DeployHelper {
    uint256 constant INITIAL_TOKEN_SUPPLY = 100_000_000_000 ether; // 100B

    function run() external {
        _loadAddresses();

        uint256 deployerPk = vm.envUint("DEV_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        vm.startBroadcast(deployerPk);

        MockOldToken token = new MockOldToken();
        token.mint(deployer, INITIAL_TOKEN_SUPPLY);

        vm.stopBroadcast();

        _saveAddress("OLD_TOKEN", address(token));
        console.log("MockOldToken deployed at:", address(token));
    }
}
