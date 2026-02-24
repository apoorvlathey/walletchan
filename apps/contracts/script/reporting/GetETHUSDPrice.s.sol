// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {stdJson} from "forge-std/StdJson.sol";
import {println} from "vulcan/_imports.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {DeployHelper} from "../DeployHelper.s.sol";

/**
 * Fetches the current ETH price in USD from the USDC/ETH pool on Base mainnet.
 *
 * Required in addresses.json (chain 8453): POOL_MANAGER, USDCETHPoolKey
 *
 * Run:
 *   cd apps/contracts && source .env && forge script script/reporting/GetETHUSDPrice.s.sol:GetETHUSDPrice -vvv --rpc-url $BASE_RPC_URL
 */
contract GetETHUSDPrice is DeployHelper {
    using stdJson for string;
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    /// @notice Returns ETH price in USD as raw USDC amount (6 decimals).
    ///         Always queries the Base mainnet USDC/ETH pool via fork.
    ///         Requires _loadAddresses() to have been called.
    function getEthUsdPrice() public returns (uint256 ethPriceRaw) {
        uint256 currentFork = vm.activeFork();
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        // On Base fork (chainid 8453), reads Base addresses from addresses.json
        ethPriceRaw = _queryEthUsdPrice();

        vm.selectFork(currentFork);
    }

    function _queryEthUsdPrice() internal view returns (uint256 ethPriceRaw) {
        IPoolManager poolManager = IPoolManager(_requireAddress("POOL_MANAGER"));

        // Read PoolKey struct from addresses.json
        string memory prefix = string.concat(".", vm.toString(block.chainid), ".USDCETHPoolKey");
        address currency0 = _addressesJson.readAddress(string.concat(prefix, ".currency0"));
        address currency1 = _addressesJson.readAddress(string.concat(prefix, ".currency1"));
        uint24 fee = uint24(_addressesJson.readUint(string.concat(prefix, ".fee")));
        int24 tickSpacing = int24(int256(_addressesJson.readInt(string.concat(prefix, ".tickSpacing"))));
        address hooks = _addressesJson.readAddress(string.concat(prefix, ".hooks"));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });
        PoolId poolId = key.toId();

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        // priceX96 = sqrtPriceX96^2 / 2^96 = (token1/token0) * 2^96
        uint256 priceX96 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1 << 96);

        // Native ETH is address(0), so USDC is token0 only if it's currency0
        bool usdcToken0 = currency0 != address(0);

        // ETH price in USDC raw (6 decimals)
        ethPriceRaw = usdcToken0
            ? FullMath.mulDiv(1e18, 1 << 96, priceX96)
            : FullMath.mulDiv(1e18, priceX96, 1 << 96);
    }

    function run() external virtual {
        _loadAddresses();

        uint256 ethPriceRaw = getEthUsdPrice();

        println("ETH/USD Price");
        println("  Price: {u:d6}", abi.encode(ethPriceRaw));
    }
}
