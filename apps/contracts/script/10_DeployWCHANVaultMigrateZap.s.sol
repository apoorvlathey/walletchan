// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {WCHANVaultMigrateZap, IWCHAN} from "@src/WCHANVaultMigrateZap.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys WCHANVaultMigrateZap — one-click migration from old sBNKRW vault to new sWCHAN vault.
 *
 * Required env vars: DEV_PRIVATE_KEY
 * Required in addresses.json: OLD_VAULT, WCHAN_VAULT, WCHAN, OLD_TOKEN
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/10_DeployWCHANVaultMigrateZap.s.sol:DeployWCHANVaultMigrateZap --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 */
contract DeployWCHANVaultMigrateZap is DeployHelper {
    function run() external {
        _loadAddresses();

        address oldVault = _requireAddress("OLD_VAULT");
        address newVault = _requireAddress("WCHAN_VAULT");
        address wchanAddr = _requireAddress("WCHAN");
        address oldTokenAddr = _requireAddress("OLD_TOKEN");

        uint256 deployerPk = vm.envUint("DEV_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);

        WCHANVaultMigrateZap zap = new WCHANVaultMigrateZap(
            IERC4626(oldVault),
            IERC4626(newVault),
            IWCHAN(wchanAddr),
            IERC20(oldTokenAddr)
        );

        vm.stopBroadcast();

        _saveAddress("WCHAN_VAULT_MIGRATE_ZAP", address(zap));

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("WCHANVaultMigrateZap:", address(zap));
        console.log("Old vault (sBNKRW):", oldVault);
        console.log("New vault (sWCHAN):", newVault);
        console.log("WCHAN:", wchanAddr);
        console.log("OLD_TOKEN:", oldTokenAddr);
    }
}
