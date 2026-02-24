// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeployHelper} from "../DeployHelper.s.sol";

/**
 * Wraps OLD_TOKEN into WCHAN by approving + calling wrap().
 *
 * Set AMOUNT_TO_WRAP below (in wei). The script reverts if the deployer's
 * OLD_TOKEN balance is less than that amount.
 *
 * Required in addresses.json: OLD_TOKEN, WCHAN
 *
 * Dry-run:
 *   cd apps/contracts && source .env && forge script script/process/WrapOldTokenToWCHAN.s.sol:WrapOldTokenToWCHAN -vvvv --rpc-url $BASE_RPC_URL
 *   cd apps/contracts && source .env && forge script script/process/WrapOldTokenToWCHAN.s.sol:WrapOldTokenToWCHAN -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 *
 * Broadcast:
 *   cd apps/contracts && source .env && forge script script/process/WrapOldTokenToWCHAN.s.sol:WrapOldTokenToWCHAN --broadcast -vvvv --rpc-url $BASE_RPC_URL
 *   cd apps/contracts && source .env && forge script script/process/WrapOldTokenToWCHAN.s.sol:WrapOldTokenToWCHAN --broadcast -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract WrapOldTokenToWCHAN is DeployHelper {
    /// @dev Amount of OLD_TOKEN to wrap into WCHAN (in wei). Adjust as needed.
    uint256 constant AMOUNT_TO_WRAP = 2_023_660_350 ether;

    function run() external {
        _loadAddresses();

        address oldToken = _requireAddress("OLD_TOKEN");
        address wchan = _requireAddress("WCHAN");
        address deployer = vm.addr(vm.envUint("DEV_PRIVATE_KEY"));

        uint256 balance = IERC20(oldToken).balanceOf(deployer);
        require(
            balance >= AMOUNT_TO_WRAP,
            string.concat(
                "Insufficient OLD_TOKEN balance. Have: ",
                vm.toString(balance),
                " Need: ",
                vm.toString(AMOUNT_TO_WRAP)
            )
        );

        console.log("Deployer:", deployer);
        console.log("OLD_TOKEN balance:", balance);
        console.log("Wrapping:", AMOUNT_TO_WRAP);

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        IERC20(oldToken).approve(wchan, AMOUNT_TO_WRAP);
        IWCHAN(wchan).wrap(AMOUNT_TO_WRAP);

        vm.stopBroadcast();

        console.log("Wrapped", AMOUNT_TO_WRAP, "OLD_TOKEN into WCHAN");
    }
}

interface IWCHAN {
    function wrap(uint256 amount) external;
}