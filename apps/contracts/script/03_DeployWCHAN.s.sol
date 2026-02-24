// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {WCHAN} from "@src/WCHAN.sol";
import {WCHANTestnet} from "@src/mocks/WCHANTestnet.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys WCHAN (or WCHANTestnet on testnets) at a vanity CREATE2 address.
 *
 * Prerequisites — mine a vanity salt using the helper script (runs GetInitCodeHash + ERADICATE2):
 *   1. cd apps/contracts && ./script/process/mine_vanity.sh base-sepolia
 *      (or: ./script/process/mine_vanity.sh base, ./script/process/mine_vanity.sh eth-sepolia)
 *   2. Save the found salt and expected address to addresses.json as WCHAN_SALT and EXPECTED_WCHAN_ADDRESS.
 *
 * Deploy:
 *   cd apps/contracts && source .env && forge script script/03_DeployWCHAN.s.sol:DeployWCHAN --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 *   cd apps/contracts && source .env && forge script script/03_DeployWCHAN.s.sol:DeployWCHAN --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 */

contract DeployWCHAN is DeployHelper {
    string constant TOKEN_URI = "ipfs://bafkreiczfp26ebjzf4trydz74n2bzxg7uxemiujfulfp54nytayc6djx3i";

    /// @dev Known OLD_TOKEN address on Base mainnet
    address constant BASE_MAINNET_OLD_TOKEN = 0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07;

    function run() external virtual {
        _loadAddresses();

        bytes32 salt = _requireBytes32("WCHAN_SALT");
        address expectedAddr = _requireAddress("EXPECTED_WCHAN_ADDRESS");

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        address deployed;
        if (_isTestnet()) {
            // Testnets — WCHANTestnet with configurable OLD_TOKEN
            address oldToken = _requireAddress("OLD_TOKEN");
            WCHANTestnet token = new WCHANTestnet{salt: salt}(TOKEN_URI, oldToken);
            deployed = address(token);
            console.log("WCHANTestnet deployed at:", deployed);
        } else {
            // Mainnet — WCHAN with hardcoded OLD_TOKEN
            require(BASE_MAINNET_OLD_TOKEN != address(0), "Set BASE_MAINNET_OLD_TOKEN");
            _saveAddress("OLD_TOKEN", BASE_MAINNET_OLD_TOKEN);

            WCHAN token = new WCHAN{salt: salt}(TOKEN_URI);
            deployed = address(token);
            console.log("WCHAN deployed at:", deployed);
        }

        vm.stopBroadcast();

        require(deployed == expectedAddr, "CREATE2 address mismatch");
        _saveAddress("WCHAN", deployed);
    }
}
