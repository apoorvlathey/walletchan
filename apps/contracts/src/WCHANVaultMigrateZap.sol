// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWCHAN {
    function wrap(uint256 amount_) external;
}

/**
 * @title WCHANVaultMigrateZap
 * @notice One-click migration from the old sBNKRW vault to the new sWCHAN vault.
 *
 *         Flow:
 *           1. Redeem shares from old vault → receive OLD_TOKEN (BNKRW)
 *           2. Wrap OLD_TOKEN 1:1 → WCHAN
 *           3. Deposit WCHAN into new vault → sWCHAN minted to caller
 *
 *         User must approve their old vault shares to this contract before calling migrate.
 *
 * @dev Stateless routing contract. No owner, no fees, no upgradability.
 *      Infinite approvals are set in the constructor since the contract never holds
 *      tokens between transactions.
 */
contract WCHANVaultMigrateZap {
    using SafeERC20 for IERC20;

    IERC4626 public immutable oldVault;
    IERC4626 public immutable newVault;
    IWCHAN public immutable wchan;
    IERC20 public immutable oldToken;

    error ZeroShares();

    /**
     * @param oldVault_ Old sBNKRW ERC4626 vault
     * @param newVault_ New sWCHAN ERC4626 vault (WCHANVault)
     * @param wchan_    WCHAN token (wraps OLD_TOKEN 1:1)
     * @param oldToken_ OLD_TOKEN (BNKRW)
     */
    constructor(
        IERC4626 oldVault_,
        IERC4626 newVault_,
        IWCHAN wchan_,
        IERC20 oldToken_
    ) {
        oldVault = oldVault_;
        newVault = newVault_;
        wchan = wchan_;
        oldToken = oldToken_;

        // Approve OLD_TOKEN → WCHAN (for wrap)
        oldToken_.approve(address(wchan_), type(uint256).max);
        // Approve WCHAN → new vault (for deposit)
        IERC20(address(wchan_)).approve(address(newVault_), type(uint256).max);
    }

    /**
     * @notice Migrate old vault shares to the new sWCHAN vault in one transaction.
     * @dev Caller must approve this contract to spend `shares` of the old vault token.
     * @param shares Number of old vault shares to migrate
     * @return newShares Number of sWCHAN shares received
     */
    function migrate(uint256 shares) external returns (uint256 newShares) {
        if (shares == 0) revert ZeroShares();

        // 1. Redeem from old vault → OLD_TOKEN sent to this contract
        uint256 oldTokenAmount = oldVault.redeem(shares, address(this), msg.sender);

        // 2. Wrap OLD_TOKEN → WCHAN (1:1)
        wchan.wrap(oldTokenAmount);

        // 3. Deposit WCHAN into new vault → sWCHAN minted directly to caller
        newShares = newVault.deposit(oldTokenAmount, msg.sender);
    }
}
