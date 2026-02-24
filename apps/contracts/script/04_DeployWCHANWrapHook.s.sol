// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {WCHAN} from "@src/WCHAN.sol";
import {WCHANWrapHook} from "@src/WCHANWrapHook.sol";
import {HookMiner} from "@src/utils/HookMiner.sol";
import {DeployHelper} from "./DeployHelper.s.sol";

/**
 * Deploys the WCHANWrapHook and initializes the WCHAN/OLD_TOKEN pool.
 *
 * Required in addresses.json: POOL_MANAGER, WCHAN
 *
 * IMPORTANT: After deployment, you must seed the PoolManager with both tokens
 * so that the first swap can succeed. The hook calls `poolManager.take()` during
 * `beforeSwap`, which transfers real tokens from the PM — before the swap router
 * settles the user's side. Without pre-funding, the first swap reverts.
 *
 * Post-deployment steps:
 *   1. Have SEED_AMOUNT of OLD_TOKEN in the PoolManager address (would already be there because of original Clanker Pool)
 *   2. Approve WCHAN contract to spend SEED_AMOUNT of OLD_TOKEN
 *   3. Call wchan.wrap(SEED_AMOUNT) to mint WCHAN
 *   4. Have SEED_AMOUNT of WCHAN in the PoolManager address (by providing liquidity to some other pool)
 *
 * Base mainnet:
 *   cd apps/contracts && source .env && forge script script/04_DeployWCHANWrapHook.s.sol:DeployWCHANWrapHook --broadcast --verify -vvvv --rpc-url $BASE_RPC_URL
 * 
 * ETH Sepolia:
 *  cd apps/contracts && source .env && forge script script/04_DeployWCHANWrapHook.s.sol:DeployWCHANWrapHook --broadcast --verify -vvvv --rpc-url $ETH_SEPOLIA_RPC_URL
 */
contract DeployWCHANWrapHook is DeployHelper {
    int24 constant TICK_SPACING = 60;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        _loadAddresses();

        address poolManagerAddr = _requireAddress("POOL_MANAGER");
        address wchanAddr = _requireAddress("WCHAN");

        IPoolManager poolManager = IPoolManager(poolManagerAddr);
        WCHAN wchan = WCHAN(wchanAddr);

        // 1. Mine a CREATE2 salt whose address encodes the required hook flags
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(poolManagerAddr, wchanAddr);
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(WCHANWrapHook).creationCode,
            constructorArgs
        );
        console.log("Hook will deploy at:", hookAddr);

        vm.startBroadcast(vm.envUint("DEV_PRIVATE_KEY"));

        // 2. Deploy the hook
        WCHANWrapHook hook = new WCHANWrapHook{salt: salt}(poolManagerAddr, wchan);
        require(address(hook) == hookAddr, "Hook address mismatch");
        console.log("WCHANWrapHook deployed at:", address(hook));

        // 3. Sort currencies and initialize the pool (fee = 0)
        address oldToken = wchan.OLD_TOKEN();
        (Currency c0, Currency c1) = address(wchan) < oldToken
            ? (Currency.wrap(address(wchan)), Currency.wrap(oldToken))
            : (Currency.wrap(oldToken), Currency.wrap(address(wchan)));

        PoolKey memory poolKey = PoolKey(c0, c1, 0, TICK_SPACING, IHooks(address(hook)));
        poolManager.initialize(poolKey, TickMath.getSqrtPriceAtTick(0));
        console.log("Pool initialized");

        vm.stopBroadcast();

        _saveAddress("WCHAN_WRAP_HOOK", address(hook));

        // Remind deployer to seed the PoolManager
        console.log("");
        console.log("=== POST-DEPLOYMENT: Seed the PoolManager ===");
        console.log("PoolManager:", poolManagerAddr);
        console.log("Send OLD_TOKEN and WCHAN to the PoolManager so the first swap can succeed.");
        console.log("See apps/contracts/README.md for details.");
    }
}
