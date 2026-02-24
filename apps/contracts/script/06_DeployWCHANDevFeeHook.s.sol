// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {WCHANDevFeeHook} from "@src/WCHANDevFeeHook.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys the WCHANDevFeeHook and initializes the WCHAN/WETH pool.
 *
 * Required env vars: DEV_PRIVATE_KEY, BASE_RPC_URL
 * Required in addresses.json:
 *   Chain 8453:    POOL_MANAGER, OLD_TOKEN_POOL_ID
 *   Current chain: POOL_MANAGER, WCHAN, WETH, DEV_ADDR
 *
 * The hook charges a 1% fee on every swap in the WCHAN/WETH pool accumulated as ETH via Internal Swap Pool
 *
 * Post-deployment steps:
 *   1. Add liquidity to the WCHAN/WETH pool via a Position Manager
 *   2. The hook will begin collecting fees on every swap
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/06_DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 * 
 * ETH Sepolia:
 *  cd apps/contracts && source .env && forge script script/06_DeployWCHANDevFeeHook.s.sol:DeployWCHANDevFeeHook --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract DeployWCHANDevFeeHook is DeployHelper {
    using StateLibrary for IPoolManager;

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

        // 2. Fetch current price from the OLD_TOKEN pool on Base mainnet
        //    (must be done outside broadcast — fork switching not allowed during broadcast)
        uint160 sqrtPriceX96;
        {
            uint160 mainnetSqrtPriceX96 = _fetchMainnetPrice();
            console.log("Mainnet sqrtPriceX96:", mainnetSqrtPriceX96);

            // Base mainnet pool: token0=ETH(0x0), token1=OLD_TOKEN
            // DevFeeHook pool: tokens sorted by address
            // If WETH is token0 (same ordering as mainnet) → use directly
            // If WCHAN is token0 (inverted) → invert the price
            bool wethIsToken0 = wethAddr < wchanAddr;
            sqrtPriceX96 = wethIsToken0
                ? mainnetSqrtPriceX96
                : uint160((uint256(1) << 192) / uint256(mainnetSqrtPriceX96));
            console.log("Pool sqrtPriceX96:", sqrtPriceX96);
        }

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        // 3. Deploy the hook
        WCHANDevFeeHook hook = new WCHANDevFeeHook{salt: salt}(
            devAddr,
            deployer,
            poolManagerAddr,
            wchanAddr,
            wethAddr
        );
        require(address(hook) == hookAddr, "Hook address mismatch");
        console.log("WCHANDevFeeHook deployed at:", address(hook));

        // 4. Initialize the pool via the hook (sets poolKey internally)
        hook.initialize(sqrtPriceX96);
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

    /// @dev Reads sqrtPriceX96 from the OLD_TOKEN pool on Base mainnet via fork
    function _fetchMainnetPrice() internal returns (uint160 sqrtPriceX96) {
        uint256 currentFork = vm.activeFork();
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        IPoolManager basePoolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        PoolId poolId = PoolId.wrap(_requireBytes32("OLD_TOKEN_POOL_ID"));
        (sqrtPriceX96,,,) = basePoolManager.getSlot0(poolId);

        vm.selectFork(currentFork);
    }
}
