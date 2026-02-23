// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {WCHANDevFeeHook} from "@src/WCHANDevFeeHook.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys the WCHANDevFeeHook and initializes the WCHAN/WETH pool.
 *
 * Required in addresses.json: POOL_MANAGER, WCHAN, WETH, DEV_ADDR
 *
 * The hook charges a 1% fee on every swap in the WCHAN/WETH pool accumulated as ETH via Internal Swap Pool
 *
 * Post-deployment steps:
 *   1. Add liquidity to the WCHAN/WETH pool via a Position Manager
 *   2. The hook will begin collecting fees on every swap
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/03_DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 * 
 * Base Sepolia:
 *  cd apps/contracts && source .env && forge script script/03_DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook --broadcast --verify -vvvv --rpc-url $BASE_SEPOLIA_RPC_URL
 */
contract DeployWCHANDevFeeHook is DeployHelper {
    /// @dev Initial sqrtPriceX96 for the pool. Set to desired starting price.
    /// Use TickMath.getSqrtPriceAtTick(tick) or calculate from price ratio.
    uint160 constant INITIAL_SQRT_PRICE_X96 = 0; // FIXME: set initial price
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        _loadAddresses();

        address poolManagerAddr = _requireAddress("POOL_MANAGER");
        address wchanAddr = _requireAddress("WCHAN");
        address wethAddr = _requireAddress("WETH");
        address devAddr = _requireAddress("DEV_ADDR");

        // 1. Mine a CREATE2 salt whose address encodes the required hook flags
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        address deployer = vm.addr(vm.envUint("DEV_PRIVATE_KEY"));
        bytes memory constructorArgs = abi.encode(devAddr, deployer, poolManagerAddr, wchanAddr, wethAddr);
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(WCHANDevFeeHook).creationCode,
            constructorArgs
        );
        console.log("Hook will deploy at:", hookAddr);

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        // 2. Deploy the hook
        WCHANDevFeeHook hook = new WCHANDevFeeHook{salt: salt}(
            devAddr,
            deployer,
            poolManagerAddr,
            wchanAddr,
            wethAddr
        );
        require(address(hook) == hookAddr, "Hook address mismatch");
        console.log("WCHANDevFeeHook deployed at:", address(hook));

        // 3. Initialize the pool via the hook (sets poolKey internally)
        require(INITIAL_SQRT_PRICE_X96 != 0, "Set INITIAL_SQRT_PRICE_X96");
        hook.initialize(INITIAL_SQRT_PRICE_X96);
        console.log("Pool initialized");

        vm.stopBroadcast();

        _saveAddress("WCHAN_DEV_FEE_HOOK", address(hook));

        // Summary
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Hook:", address(hook));
        console.log("Dev fee recipient:", devAddr);
        console.log("Pool: WCHAN/WETH with 1% dev fee + ISP");
        console.log("");
        console.log("Next: Add liquidity to the pool via a Position Manager.");
    }
}
