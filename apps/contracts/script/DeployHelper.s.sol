// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/**
 * @title DeployHelper
 * @notice Base contract for deploy scripts. Reads/writes addresses from/to addresses.json
 *         so that scripts form a dependency chain (00 → 01 → 02 → 03).
 *
 *         External/protocol addresses (POOL_MANAGER, WETH, DEV_ADDR) must be pre-populated
 *         in addresses.json under the target chain ID before running dependent scripts.
 */
abstract contract DeployHelper is Script {
    using stdJson for string;

    string constant ADDRESSES_FILE = "addresses.json";
    string internal _addressesJson;

    /// @notice Load addresses.json into memory. Call at start of run().
    function _loadAddresses() internal {
        _addressesJson = vm.readFile(ADDRESSES_FILE);
    }

    /// @notice Read address by name for the current chain. Reverts if missing or zero.
    function _requireAddress(string memory name) internal view returns (address) {
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        require(
            vm.keyExistsJson(_addressesJson, key),
            string.concat("Missing address: ", name, " for chain ", vm.toString(block.chainid))
        );
        address addr = _addressesJson.readAddress(key);
        require(
            addr != address(0),
            string.concat("Zero address: ", name, " for chain ", vm.toString(block.chainid))
        );
        return addr;
    }

    /// @notice Check if an address exists for the current chain.
    function _hasAddress(string memory name) internal view returns (bool) {
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        return vm.keyExistsJson(_addressesJson, key);
    }

    /// @notice Read address if it exists, else return address(0).
    function _getAddress(string memory name) internal view returns (address) {
        if (!_hasAddress(name)) return address(0);
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        return _addressesJson.readAddress(key);
    }

    /// @notice Returns true if running on a known testnet chain.
    function _isTestnet() internal view returns (bool) {
        return block.chainid == 84532 || block.chainid == 11155111; // Base Sepolia, Eth Sepolia
    }

    /// @notice Read bytes32 by name for the current chain. Reverts if missing.
    function _requireBytes32(string memory name) internal view returns (bytes32) {
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        require(
            vm.keyExistsJson(_addressesJson, key),
            string.concat("Missing bytes32: ", name, " for chain ", vm.toString(block.chainid))
        );
        return _addressesJson.readBytes32(key);
    }

    /// @notice Write a deployed address to addresses.json for the current chain.
    function _saveAddress(string memory name, address addr) internal {
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        string memory value = vm.toString(addr);
        vm.writeJson(value, ADDRESSES_FILE, key);
        // Re-read so subsequent saves within the same script see prior writes
        _addressesJson = vm.readFile(ADDRESSES_FILE);
    }

    /// @notice Write a bytes32 value to addresses.json for the current chain.
    function _saveBytes32(string memory name, bytes32 val) internal {
        string memory key = string.concat(".", vm.toString(block.chainid), ".", name);
        string memory value = vm.toString(val);
        vm.writeJson(value, ADDRESSES_FILE, key);
        _addressesJson = vm.readFile(ADDRESSES_FILE);
    }
}
