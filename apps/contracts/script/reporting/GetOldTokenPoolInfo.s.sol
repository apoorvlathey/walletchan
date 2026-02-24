// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {println} from "vulcan/_imports.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {GetETHUSDPrice} from "./GetETHUSDPrice.s.sol";

/**
 * Fetches the current tick, sqrtPriceX96, and USD market cap for the OLD_TOKEN pool.
 *
 * Required in addresses.json: POOL_MANAGER, OLD_TOKEN, OLD_TOKEN_POOL_ID, WETH (or ETH as address(0)),
 *                              USDCETHPoolKey (for ETH/USD price)
 *
 * Run:
 *   cd apps/contracts && source .env && forge script script/reporting/GetOldTokenPoolInfo.s.sol:GetOldTokenPoolInfo -vvv --rpc-url $ETH_SEPOLIA_RPC_URL
 *   cd apps/contracts && source .env && forge script script/reporting/GetOldTokenPoolInfo.s.sol:GetOldTokenPoolInfo -vvv --rpc-url $BASE_RPC_URL
 */
contract GetOldTokenPoolInfo is GetETHUSDPrice {
    using StateLibrary for IPoolManager;

    /// @notice Returns the OLD_TOKEN market cap in USD (6 decimals) and ETH/USD price (6 decimals).
    ///         Requires _loadAddresses() to have been called.
    function _getOldTokenMcapUsd6() internal returns (uint256 mcapUsd6, uint256 ethPriceRaw) {
        IPoolManager poolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        PoolId poolId = PoolId.wrap(_requireBytes32("OLD_TOKEN_POOL_ID"));
        address oldToken = _requireAddress("OLD_TOKEN");
        address weth = _getAddress("WETH");

        // Determine token ordering: on Base mainnet ETH is address(0) so always token0,
        // but on testnets with WETH the ordering depends on address comparison.
        bool oldTokenIsToken0 = weth != address(0) && oldToken < weth;

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint256 totalSupply = IERC20(oldToken).totalSupply();
        ethPriceRaw = getEthUsdPrice();

        // sqrtPriceX96 = sqrt(token1/token0) * 2^96
        // priceX96 = sqrtPriceX96^2 / 2^96 = (token1/token0) * 2^96
        uint256 priceX96 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1 << 96);

        uint256 totalSupplyInEth;
        if (oldTokenIsToken0) {
            totalSupplyInEth = FullMath.mulDiv(totalSupply, priceX96, 1 << 96);
        } else {
            totalSupplyInEth = FullMath.mulDiv(totalSupply, 1 << 96, priceX96);
        }

        mcapUsd6 = FullMath.mulDiv(totalSupplyInEth, ethPriceRaw, 1e18);
    }

    function run() external virtual override {
        _loadAddresses();

        IPoolManager poolManager = IPoolManager(_requireAddress("POOL_MANAGER"));
        PoolId poolId = PoolId.wrap(_requireBytes32("OLD_TOKEN_POOL_ID"));
        address oldToken = _requireAddress("OLD_TOKEN");

        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);
        uint256 totalSupply = IERC20(oldToken).totalSupply();
        (uint256 mcapUsd6, uint256 ethPriceRaw) = _getOldTokenMcapUsd6();

        println("OLD_TOKEN Pool Info");
        println("  sqrtPriceX96: {u}", abi.encode(sqrtPriceX96));
        println("  tick: {i}", abi.encode(tick));
        println("  totalSupply: {u:d18}", abi.encode(totalSupply));
        println("  ETH/USD: {u:d6}", abi.encode(ethPriceRaw));
        println("  Market Cap (USD): {u:d6}", abi.encode(mcapUsd6));
    }
}
