// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @dev Finds a CREATE2 salt producing an address whose low 14 bits match the required hook `flags`
library HookMiner {
    uint160 constant FLAG_MASK = 0x3FFF;
    uint256 constant MAX_LOOP = 200_000;

    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal view returns (address, bytes32) {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        for (uint256 salt; salt < MAX_LOOP; salt++) {
            address addr = computeAddress(deployer, salt, initCode);
            if (uint160(addr) & FLAG_MASK == flags && addr.code.length == 0) {
                return (addr, bytes32(salt));
            }
        }
        revert("HookMiner: could not find salt");
    }

    function computeAddress(address deployer, uint256 salt, bytes memory initCode) internal pure returns (address) {
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xFF), deployer, bytes32(salt), keccak256(initCode))
        ))));
    }
}
