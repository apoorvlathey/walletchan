// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WCHANVault} from "@src/WCHANVault.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys the WCHANVault (sWCHAN) — an ERC4626 staking vault for WCHAN with
 * WETH reward distribution and early-withdrawal penalty.
 *
 * The constructor requires a small WCHAN seed deposit (inflation-attack protection).
 * This script pre-computes the vault address via nonce, approves WCHAN, then deploys.
 *
 * Required env vars: DEV_PRIVATE_KEY
 * Required in addresses.json: WCHAN, WETH
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/08_DeployWCHANVault.s.sol:DeployWCHANVault --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 *
 * ETH Sepolia:
 *   cd apps/contracts && source .env && forge script script/08_DeployWCHANVault.s.sol:DeployWCHANVault --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract DeployWCHANVault is DeployHelper {
    /// @dev Small seed amount for dead shares (inflation-attack protection).
    ///      1e6 wei = 0.000000000001 WCHAN — negligible cost.
    uint256 constant SEED_AMOUNT = 1e6;

    function run() external {
        _loadAddresses();

        address wchanAddr = _requireAddress("WCHAN");
        address wethAddr = _requireAddress("WETH");

        uint256 deployerPk = vm.envUint("DEV_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        // Pre-compute vault address so we can approve WCHAN before deployment
        uint64 nonce = vm.getNonce(deployer);
        address predictedVault = vm.computeCreateAddress(deployer, nonce + 1); // +1 because approve tx is first
        console.log("Predicted vault address:", predictedVault);

        vm.startBroadcast(deployerPk);

        // 1. Approve WCHAN for the seed deposit
        IERC20(wchanAddr).approve(predictedVault, SEED_AMOUNT);

        // 2. Deploy vault
        WCHANVault vault = new WCHANVault(
            IERC20(wchanAddr),
            IERC20(wethAddr),
            SEED_AMOUNT
        );
        require(address(vault) == predictedVault, "Vault address mismatch");
        console.log("WCHANVault deployed at:", address(vault));

        vm.stopBroadcast();

        _saveAddress("WCHAN_VAULT", address(vault));

        // Summary
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("WCHANVault (sWCHAN):", address(vault));
        console.log("Asset (WCHAN):", wchanAddr);
        console.log("Reward token (WETH):", wethAddr);
        console.log("Seed amount:", SEED_AMOUNT);
        console.log("");
        console.log("Next: Deploy DripWCHANRewards (script 09) to set up reward distribution.");
    }
}
