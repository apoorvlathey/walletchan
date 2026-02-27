// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626, ERC20, IERC20, Math} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20Permit, Nonces} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WCHANVault (sWCHAN)
 * @notice ERC4626 vault for staking WCHAN. Depositors receive sWCHAN shares.
 *
 *         Two yield channels:
 *           1. WCHAN yield — anyone calls `donate()` to send WCHAN into the vault
 *              without receiving shares, raising the share price for all holders.
 *           2. WETH rewards — anyone calls `donateReward(amount)` to distribute
 *              WETH pro-rata to share holders via a Synthetix-style per-share
 *              accumulator. Stakers claim WETH via `claimRewards()`.
 *
 *         Early withdrawal penalty (WCHAN only): 20% linearly decaying to 0%
 *         over 7 days. 50% of penalty is burned, 50% stays in the vault as yield.
 *         WETH rewards have no penalty — they are earned yield, claimable anytime.
 *
 * @dev Fully permissionless — no owner, no fees, no access control.
 *
 *      WETH reward design (Synthetix pattern):
 *        - `rewardPerShareStored` tracks cumulative WETH per share (1e18 scaled).
 *        - On every balance change (deposit, withdraw, transfer), both `from` and
 *          `to` are snapshotted via `_snapshotReward` before `super._update`.
 *        - `earned(account)` = delta(rewardPerShare) × balance + buffered rewards.
 *        - WETH accounting is fully separate from ERC4626 — `totalAssets()` only
 *          counts WCHAN; WETH sits in the contract independently.
 *
 *      Penalty design:
 *        - Each address has a single weighted-average deposit timestamp.
 *        - On each deposit (or incoming share transfer), the timestamp is blended:
 *            newTs = (oldTs * existingShares + now * incomingShares) / totalShares
 *          This means a small top-up barely moves the timer, while a large one
 *          shifts it significantly. It's not gameable (depositing 1 wei doesn't reset).
 *        - Partial redeems do NOT reset or update the timer; only deposits/receives do.
 *
 *      ERC4626 note:
 *        `previewRedeem` / `previewWithdraw` return gross (pre-penalty) values because
 *        they have no `owner` parameter. Use `previewRedeemNet(shares, owner)` and
 *        `getPenaltyBps(owner)` for penalty-aware UI previews.
 */
contract WCHANVault is ERC4626, ERC20Permit, ERC20Votes {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ── Constants ──

    /// @notice Duration of the penalty cooldown window
    uint256 public constant PENALTY_DURATION = 7 days;

    /// @notice Starting penalty at deposit time (20%), expressed in basis points
    uint256 public constant MAX_PENALTY_BPS = 2000;

    /// @notice Basis-point denominator (100% = 10 000)
    uint256 public constant BPS = 10_000;

    /// @notice Address where burned penalty tokens are sent (unrecoverable)
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ── State ──

    /// @notice Weighted-average deposit timestamp per address (for penalty calculation).
    ///         Updated on every mint (deposit) and incoming share transfer.
    ///         Not updated on redeem/withdraw — partial exits don't reset the timer.
    mapping(address => uint256) public lastDepositTimestamp;

    // ── WETH Reward State ──

    /// @notice WETH token used for reward distribution
    IERC20 public immutable rewardToken;

    /// @notice Global accumulator: total WETH reward per share (scaled by 1e18)
    uint256 public rewardPerShareStored;

    /// @notice Per-user snapshot of rewardPerShareStored at last interaction
    mapping(address => uint256) public userRewardPerSharePaid;

    /// @notice Buffered WETH owed to each user (not yet claimed)
    mapping(address => uint256) public unclaimedRewards;

    // ── Events ──

    /// @notice Emitted when WCHAN is donated to the vault (no shares minted)
    event Donate(address indexed sender, uint256 amount, uint256 totalAssets, uint256 totalShares);

    /// @notice Emitted when WETH rewards are donated to the vault
    event DonateReward(address indexed sender, uint256 amount, uint256 totalAssets, uint256 totalShares);

    /// @notice Emitted when a user claims their WETH rewards
    event RewardsClaimed(address indexed account, uint256 amount);

    /// @notice Emitted when an early withdrawal penalty is applied
    /// @param owner       The share holder who incurred the penalty
    /// @param penaltyAmount Total WCHAN deducted from the withdrawal
    /// @param burnedAmount  Half of penalty sent to BURN_ADDRESS (removed from supply)
    /// @param retainedAmount Remaining half left in vault (accrues to other stakers)
    /// @param totalAssets  Vault totalAssets after penalty (for APY indexing)
    /// @param totalShares  Vault totalSupply after penalty (for APY indexing)
    event EarlyWithdrawPenalty(
        address indexed owner,
        uint256 penaltyAmount,
        uint256 burnedAmount,
        uint256 retainedAmount,
        uint256 totalAssets,
        uint256 totalShares
    );

    // ── Errors ──

    error ZeroAmount();
    error NoStakers();
    error RewardTokenSameAsAsset();

    /**
     * @param wchan_       The WCHAN token (vault asset).
     * @param rewardToken_ The WETH token (reward asset).
     * @param seedAmount_  Small WCHAN amount to seed dead shares (inflation-attack
     *                     protection). Deployer must approve this vault address
     *                     BEFORE deployment (pre-compute address via CREATE2 or
     *                     nonce). The shares are minted directly to BURN_ADDRESS.
     *                     Use e.g. 1e6 wei (0.000000000001 WCHAN).
     */
    constructor(
        IERC20 wchan_,
        IERC20 rewardToken_,
        uint256 seedAmount_
    ) ERC4626(wchan_) ERC20("Staked WCHAN", "sWCHAN") ERC20Permit("Staked WCHAN") {
        if (address(rewardToken_) == address(wchan_)) revert RewardTokenSameAsAsset();
        rewardToken = rewardToken_;

        // Seed dead shares to prevent ERC4626 inflation/donation attack.
        // Pulls seedAmount_ WCHAN from deployer, mints shares to BURN_ADDRESS.
        if (seedAmount_ > 0) {
            IERC20(asset()).safeTransferFrom(msg.sender, address(this), seedAmount_);
            _mint(BURN_ADDRESS, seedAmount_);
        }
    }

    // ═══════════════════════════════════════════════
    //              External Functions
    // ═══════════════════════════════════════════════

    /**
     * @notice Donate WCHAN to the vault, increasing share value for all holders.
     * @dev Pulls tokens via `safeTransferFrom` — caller must approve the vault first.
     *      Because no shares are minted, `totalAssets()` rises while `totalSupply()`
     *      stays the same, meaning each existing share is now worth more WCHAN.
     *      Reverts if no stakers exist (prevents ERC4626 inflation attack vector).
     * @param _amount Amount of WCHAN to donate (must be > 0).
     */
    function donate(uint256 _amount) external {
        if (_amount == 0) revert ZeroAmount();
        if (totalSupply() == 0) revert NoStakers();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), _amount);
        emit Donate(msg.sender, _amount, totalAssets(), totalSupply());
    }

    /**
     * @notice Donate WETH rewards to the vault, distributed pro-rata to all share holders.
     * @dev Uses Synthetix-style per-share accumulator. Caller must approve rewardToken first.
     *      Reverts if no stakers exist (WETH would be unaccounted for).
     * @param amount Amount of WETH to donate (must be > 0).
     */
    function donateReward(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (totalSupply() == 0) revert NoStakers();

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPerShareStored += Math.mulDiv(amount, 1e18, totalSupply());

        emit DonateReward(msg.sender, amount, totalAssets(), totalSupply());
    }

    /**
     * @notice Claim all accumulated WETH rewards for the caller.
     * @dev CEI pattern: snapshots and zeroes state before external transfer.
     *      No penalty applied — WETH rewards are earned yield, claimable anytime.
     */
    function claimRewards() external {
        _snapshotReward(msg.sender);

        uint256 owed = unclaimedRewards[msg.sender];
        unclaimedRewards[msg.sender] = 0;

        if (owed == 0) revert ZeroAmount();

        rewardToken.safeTransfer(msg.sender, owed);

        emit RewardsClaimed(msg.sender, owed);
    }

    /**
     * @notice Redeem `shares` for underlying WCHAN, minus any early-withdrawal penalty.
     * @dev Overrides ERC4626.redeem to inject penalty logic.
     *
     *      Flow:
     *        1. Convert shares → gross assets (standard ERC4626 math)
     *        2. Apply penalty via `_applyPenalty` → net + penalty
     *        3. Delegate to `_executeWithdraw` which handles burn, transfers, and events
     *
     * @return netAssets The actual WCHAN transferred to `receiver` (after penalty)
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        uint256 grossAssets = _convertToAssets(shares, Math.Rounding.Floor);
        (uint256 netAssets, uint256 penalty) = _applyPenalty(grossAssets, owner);

        _executeWithdraw(receiver, owner, netAssets, penalty, shares);
        return netAssets;
    }

    /**
     * @notice Withdraw exactly `assets` WCHAN to `receiver`, burning extra shares to
     *         cover the early-withdrawal penalty.
     * @dev Overrides ERC4626.withdraw to inject penalty logic.
     *
     *      Flow:
     *        1. Reverse-calculate grossAssets from the desired net `assets`:
     *             grossAssets = ⌈assets × BPS / (BPS − penaltyBps)⌉
     *           Ceiling ensures the receiver gets at least `assets`.
     *        2. Convert grossAssets → shares (round up, so vault doesn't lose)
     *        3. Delegate to `_executeWithdraw` which handles burn, transfers, and events
     *
     *      The shares cap (`min(shares, ownerBalance)`) handles a rounding edge case:
     *      `maxWithdraw` rounds down while `_convertToShares` rounds up, which can
     *      produce 1 extra share on boundary values. Capping is safe because the
     *      `maxWithdraw` check already guarantees the owner has enough value.
     *
     * @return shares The number of vault shares burned to fulfill this withdrawal
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);
        }

        // Reverse-calculate: how many gross assets cover `assets` net after penalty?
        uint256 grossAssets = _grossFromNet(assets, owner);

        // Convert gross to shares (round up so vault doesn't under-burn)
        uint256 shares = _convertToShares(grossAssets, Math.Rounding.Ceil);

        // Safety cap: rounding between maxWithdraw (floor) and _convertToShares (ceil)
        // can overshoot by 1 share at boundary values. This is safe because the
        // maxWithdraw check above already validated the owner has enough value.
        uint256 ownerBalance = balanceOf(owner);
        if (shares > ownerBalance) shares = ownerBalance;

        uint256 penalty = grossAssets - assets;
        _executeWithdraw(receiver, owner, assets, penalty, shares);
        return shares;
    }

    // ═══════════════════════════════════════════════
    //               View Functions
    // ═══════════════════════════════════════════════

    /**
     * @notice Returns the current unclaimed WETH rewards for `account`.
     * @dev View function for UI display. Matches actual claimable amount.
     */
    function earned(address account) public view returns (uint256) {
        return Math.mulDiv(
            balanceOf(account),
            rewardPerShareStored - userRewardPerSharePaid[account],
            1e18
        ) + unclaimedRewards[account];
    }

    /**
     * @notice Returns the current early-withdrawal penalty in basis points for `owner`.
     * @dev Linear decay: MAX_PENALTY_BPS at t=0, 0 at t=PENALTY_DURATION.
     *      Formula: penaltyBps = MAX_PENALTY_BPS × (PENALTY_DURATION − elapsed) / PENALTY_DURATION
     *      Returns 0 if the address has never deposited or the cooldown has expired.
     */
    function getPenaltyBps(address owner) public view returns (uint256) {
        uint256 depositTime = lastDepositTimestamp[owner];
        if (depositTime == 0) return 0;

        uint256 elapsed = block.timestamp - depositTime;
        if (elapsed >= PENALTY_DURATION) return 0;

        return MAX_PENALTY_BPS * (PENALTY_DURATION - elapsed) / PENALTY_DURATION;
    }

    /**
     * @notice Preview the net assets received after penalty for redeeming `shares`.
     * @dev Use this instead of `previewRedeem` for penalty-aware UI display.
     *      `previewRedeem` cannot account for penalty because it lacks an `owner` param.
     * @param shares Number of vault shares to redeem
     * @param owner  Address whose penalty timer is used
     * @return Net WCHAN the owner would receive after penalty deduction
     */
    function previewRedeemNet(uint256 shares, address owner) external view returns (uint256) {
        uint256 gross = _convertToAssets(shares, Math.Rounding.Floor);
        (uint256 net, ) = _applyPenalty(gross, owner);
        return net;
    }

    /**
     * @notice Returns the max net assets (after penalty) that `owner` can withdraw.
     * @dev Overrides ERC4626.maxWithdraw to account for penalty deduction.
     *      Without this override, a user could call `withdraw(maxWithdraw(owner))`
     *      but the penalty math would require more shares than they actually own.
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 grossAssets = _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
        (uint256 net, ) = _applyPenalty(grossAssets, owner);
        return net;
    }

    /// @dev ERC4626 already overrides decimals(); we just resolve the Solidity
    ///      multiple-inheritance conflict between ERC20 and ERC4626.
    function decimals() public view override(ERC4626, ERC20) returns (uint8) {
        return super.decimals();
    }

    /// @dev Resolves nonce conflict between ERC20Permit and Nonces
    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /// @dev Uses block.timestamp instead of block.number for vote checkpointing (ERC-6372)
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /// @dev Machine-readable clock mode descriptor per ERC-6372
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // ═══════════════════════════════════════════════
    //              Internal Functions
    // ═══════════════════════════════════════════════

    /**
     * @dev Snapshot reward state for `account` before any balance change.
     *      Buffers earned WETH and updates the user's accumulator snapshot.
     */
    function _snapshotReward(address account) internal {
        unclaimedRewards[account] = earned(account);
        userRewardPerSharePaid[account] = rewardPerShareStored;
    }

    /**
     * @dev Single source of truth for the forward penalty calculation (gross → net).
     *      Used by `redeem`, `maxWithdraw`, and `previewRedeemNet`.
     *
     *      penalty = gross × penaltyBps / BPS  (rounds down — favors the user)
     *      net     = gross − penalty
     *
     * @param grossAssets Total underlying value before penalty
     * @param owner       Address whose penalty timer is used
     * @return net        Assets the user receives after penalty
     * @return penalty    Assets deducted as penalty (0 if cooldown expired)
     */
    function _applyPenalty(
        uint256 grossAssets,
        address owner
    ) internal view returns (uint256 net, uint256 penalty) {
        uint256 penaltyBps = getPenaltyBps(owner);
        penalty = grossAssets * penaltyBps / BPS;
        net = grossAssets - penalty;
    }

    /**
     * @dev Reverse penalty calculation (net → gross). Used by `withdraw`.
     *      Given a desired net amount, returns the gross assets needed to cover it
     *      plus the penalty.
     *
     *      grossAssets = ⌈net × BPS / (BPS − penaltyBps)⌉
     *      Rounds up so the receiver always gets at least `netAssets`.
     *      When penalty is 0, returns `netAssets` directly (no math needed).
     *
     * @param netAssets Desired net amount the receiver should get
     * @param owner    Address whose penalty timer is used
     * @return grossAssets Total assets to deduct from the vault (net + penalty)
     */
    function _grossFromNet(
        uint256 netAssets,
        address owner
    ) internal view returns (uint256 grossAssets) {
        uint256 penaltyBps = getPenaltyBps(owner);
        if (penaltyBps > 0) {
            grossAssets = (netAssets * BPS).ceilDiv(BPS - penaltyBps);
        } else {
            grossAssets = netAssets;
        }
    }

    /**
     * @dev Common execution path for both `redeem` and `withdraw`.
     *      Handles allowance spending, share burning, asset transfers, and penalty split.
     *
     *      Penalty split:
     *        - `penalty / 2` → sent to BURN_ADDRESS (permanently removed from supply)
     *        - `penalty − penalty/2` → stays in vault implicitly (never transferred out),
     *          increasing `totalAssets()` relative to `totalSupply()` for remaining holders.
     *        The `penalty − penalty/2` pattern (instead of `penalty/2` twice) ensures
     *        no dust is lost to rounding — the vault always gets the remainder.
     *
     * @param receiver  Address receiving the net WCHAN
     * @param owner     Share holder whose shares are burned
     * @param netAssets WCHAN to send to `receiver` (already penalty-adjusted)
     * @param penalty   Total penalty in WCHAN (0 if cooldown expired)
     * @param shares    Vault shares to burn from `owner`
     */
    function _executeWithdraw(
        address receiver,
        address owner,
        uint256 netAssets,
        uint256 penalty,
        uint256 shares
    ) internal {
        // Allowance check — lets approved operators redeem/withdraw on owner's behalf
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // Transfer net amount to receiver
        IERC20 token = IERC20(asset());
        token.safeTransfer(receiver, netAssets);

        // Split penalty — half burned, half retained as yield for remaining stakers
        if (penalty > 0) {
            uint256 burnAmount = penalty / 2;
            uint256 retained = penalty - burnAmount;
            if (burnAmount > 0) {
                token.safeTransfer(BURN_ADDRESS, burnAmount);
            }
            emit EarlyWithdrawPenalty(owner, penalty, burnAmount, retained, totalAssets(), totalSupply());
        }

        emit Withdraw(msg.sender, receiver, owner, netAssets, shares);
    }

    /**
     * @dev Hook into every ERC20 balance change for two purposes:
     *
     *      1. WETH reward snapshotting — `_snapshotReward` is called for both
     *         `from` and `to` (when non-zero) BEFORE balances change. This
     *         buffers each party's earned WETH at their current balance, so
     *         transfers/mints/burns don't cause double-claims or lost rewards.
     *
     *      2. Penalty timestamp tracking — only updates when `to != address(0)`
     *         (skip burns) and `value > 0`:
     *         - Mint (from=0, to=depositor): blend new deposit with existing timestamp
     *         - Transfer (from=sender, to=recipient): treat incoming shares as a fresh
     *           deposit for the recipient, preventing penalty bypass via share transfer
     *         - Burn (to=0): no-op — partial redeems don't change the timer
     *
     *      Both steps read pre-update balances, so they must run before `super._update`.
     *
     *      Weighted average formula (timestamps):
     *        newTs = (oldTs × existingShares + block.timestamp × incomingShares) / totalShares
     */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        // 1. Snapshot WETH rewards for both parties BEFORE balances change
        if (from != address(0)) _snapshotReward(from);
        if (to != address(0)) _snapshotReward(to);

        // 2. Penalty timestamp logic (also reads pre-update balances)
        if (to != address(0) && value > 0) {
            // Read balance BEFORE super._update modifies it
            uint256 existingShares = balanceOf(to);
            uint256 oldTimestamp = lastDepositTimestamp[to];

            if (existingShares > 0 && oldTimestamp > 0) {
                // Blend: a small top-up barely moves the timer; a large deposit
                // shifts it significantly toward now
                lastDepositTimestamp[to] =
                    (oldTimestamp * existingShares + block.timestamp * value) /
                    (existingShares + value);
            } else {
                // First deposit (or re-deposit after full redeem) — fresh timer
                lastDepositTimestamp[to] = block.timestamp;
            }
        }

        super._update(from, to, value);
    }
}
