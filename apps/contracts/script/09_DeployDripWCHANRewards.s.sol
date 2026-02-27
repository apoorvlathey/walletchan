// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWCHANVault, DripWCHANRewards} from "@src/DripWCHANRewards.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys the DripWCHANRewards contract — a smooth reward distributor that drips
 * WCHAN and WETH into the WCHANVault over configurable time windows.
 *
 * The owner (DEV_ADDR) can top up tokens and set distribution end timestamps.
 * Anyone can call drip() to push the proportional amount into the vault.
 *
 * Required env vars: DEV_PRIVATE_KEY
 * Required in addresses.json: WCHAN, WETH, WCHAN_VAULT, DEV_ADDR
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/09_DeployDripWCHANRewards.s.sol:DeployDripWCHANRewards --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 *
 * ETH Sepolia:
 *   cd apps/contracts && source .env && forge script script/09_DeployDripWCHANRewards.s.sol:DeployDripWCHANRewards --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract DeployDripWCHANRewards is DeployHelper {
    function run() external {
        _loadAddresses();

        address wchanAddr = _requireAddress("WCHAN");
        address wethAddr = _requireAddress("WETH");
        address vaultAddr = _requireAddress("WCHAN_VAULT");
        address devAddr = _requireAddress("DEV_ADDR");

        uint256 deployerPk = vm.envUint("DEV_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);

        DripWCHANRewards drip = new DripWCHANRewards(
            devAddr,
            IWCHANVault(vaultAddr),
            IERC20(wchanAddr),
            IERC20(wethAddr)
        );
        console.log("DripWCHANRewards deployed at:", address(drip));

        vm.stopBroadcast();

        _saveAddress("DRIP_WCHAN_REWARDS", address(drip));

        // Summary
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("DripWCHANRewards:", address(drip));
        console.log("Owner:", devAddr);
        console.log("Vault:", vaultAddr);
        console.log("WCHAN:", wchanAddr);
        console.log("WETH:", wethAddr);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Approve WCHAN and/or WETH to the DripWCHANRewards contract");
        console.log("  2. Call configureDrip() to set up distribution streams");
        console.log("  3. Set up a bot to call drip() periodically (~1 hour)");
    }
}
