// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {WCHANDevFeeHook} from "@src/WCHANDevFeeHook.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";

/**
 * Deploys the WCHANDevFeeHook and initializes the WCHAN/WETH pool.
 *
 * The hook charges a 1% fee on every swap in the WCHAN/WETH pool accumulated as ETH via Internal Swap Pool
 *
 * Post-deployment steps:
 *   1. Add liquidity to the WCHAN/WETH pool via a Position Manager
 *   2. The hook will begin collecting fees on every swap
 *
 * Usage:
 *   cd apps/contracts && source .env && \
 *   forge script --chain base script/DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook \
 *     --rpc-url $BASE_RPC_URL --broadcast --verify -vvvv
 */
contract DeployWCHANDevFeeHook is Script {
    // Base mainnet addresses
    address constant POOL_MANAGER = address(0); // FIXME: set to Base PoolManager address
    address constant WCHAN_ADDR = address(0);   // FIXME: set to deployed WCHAN address
    address constant WETH_ADDR = address(0);    // FIXME: set to Base WETH address
    address constant DEV_ADDR = address(0);     // FIXME: set to dev fee recipient address

    /// @dev Initial sqrtPriceX96 for the pool. Set to desired starting price.
    /// Use TickMath.getSqrtPriceAtTick(tick) or calculate from price ratio.
    uint160 constant INITIAL_SQRT_PRICE_X96 = 0; // FIXME: set initial price

    function run() external {
        // 1. Mine a CREATE2 salt whose address encodes the required hook flags
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        address deployer = vm.addr(vm.envUint("DEV_PRIVATE_KEY"));
        bytes memory constructorArgs = abi.encode(DEV_ADDR, deployer, POOL_MANAGER, WCHAN_ADDR, WETH_ADDR);
        (address hookAddr, bytes32 salt) = HookMiner.find(
            deployer,
            flags,
            type(WCHANDevFeeHook).creationCode,
            constructorArgs
        );
        console.log("Hook will deploy at:", hookAddr);

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        // 2. Deploy the hook
        WCHANDevFeeHook hook = new WCHANDevFeeHook{salt: salt}(
            DEV_ADDR,
            deployer,
            POOL_MANAGER,
            WCHAN_ADDR,
            WETH_ADDR
        );
        require(address(hook) == hookAddr, "Hook address mismatch");
        console.log("WCHANDevFeeHook deployed at:", address(hook));

        // 3. Initialize the pool via the hook (sets poolKey internally)
        require(INITIAL_SQRT_PRICE_X96 != 0, "Set INITIAL_SQRT_PRICE_X96");
        hook.initialize(INITIAL_SQRT_PRICE_X96);
        console.log("Pool initialized");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Hook:", address(hook));
        console.log("Dev fee recipient:", DEV_ADDR);
        console.log("Pool: WCHAN/WETH with 1% dev fee + ISP");
        console.log("");
        console.log("Next: Add liquidity to the pool via a Position Manager.");
    }
}
