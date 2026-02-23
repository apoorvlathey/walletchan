// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/Script.sol";
import {WCHAN} from "@src/WCHAN.sol";
import {WCHANTestnet} from "@src/mocks/WCHANTestnet.sol";
import {DeployWCHAN} from "../01_DeployWCHAN.s.sol";

/**
 * Computes the WCHAN init code for the target chain and writes it to a file
 * for use with ERADICATE2's -i flag. Also saves the hash to addresses.json.
 *
 * Inherits DeployWCHAN to reuse TOKEN_URI (single source of truth).
 *
 * Called automatically by mine_vanity.sh — not typically run directly.
 */
contract GetInitCodeHash is DeployWCHAN {
    function run() external override {
        bytes memory initCode;

        if (block.chainid == 84532) {
            // Base Sepolia — WCHANTestnet(tokenURI, oldToken)
            _loadAddresses();
            address oldToken = _requireAddress("OLD_TOKEN");
            initCode = abi.encodePacked(
                type(WCHANTestnet).creationCode,
                abi.encode(TOKEN_URI, oldToken)
            );
        } else {
            // Base mainnet — WCHAN(tokenURI)
            initCode = abi.encodePacked(
                type(WCHAN).creationCode,
                abi.encode(TOKEN_URI)
            );
        }

        bytes32 hash = keccak256(initCode);

        console.log("Chain:", block.chainid);
        console.log("WCHAN_INIT_CODE_HASH:");
        console.logBytes32(hash);

        // Save hash to addresses.json
        string memory key = string.concat(".", vm.toString(block.chainid), ".WCHAN_INIT_CODE_HASH");
        vm.writeJson(vm.toString(hash), ADDRESSES_FILE, key);

        // Write raw init code hex to file for ERADICATE2 -i flag
        string memory initCodeFile = string.concat("wchan_init_code_", vm.toString(block.chainid), ".hex");
        vm.writeFile(initCodeFile, vm.toString(initCode));

        console.log("Saved hash to addresses.json");
        console.log("Saved init code to", initCodeFile);
    }
}
