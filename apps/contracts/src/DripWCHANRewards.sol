// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Minimal interface for WCHANVault — only the functions this contract calls.
interface IWCHANVault {
    /// @notice Donate WCHAN to the vault (raises share price for all holders).
    function donate(uint256 amount) external;
    /// @notice Donate WETH rewards pro-rata to all share holders.
    function donateReward(uint256 amount) external;
    /// @notice Total sWCHAN shares outstanding (used to check if stakers exist).
    function totalSupply() external view returns (uint256);
}

/**
 * @title DripWCHANRewards
 * @notice Smoothly distributes WCHAN and WETH rewards to the WCHANVault over time.
 *
 *         The owner tops up tokens and configures a distribution window (end timestamp).
 *         An off-chain bot (or anyone) calls `drip()` periodically (e.g. every ~1 hour)
 *         to move the proportional amount into the vault.
 *
 *         Two independent streams:
 *           - WCHAN stream → calls `vault.donate()` (raises sWCHAN share price)
 *           - WETH stream  → calls `vault.donateReward()` (pro-rata WETH to stakers)
 *
 *         Self-correcting: if drips are missed, the next call catches up proportionally.
 *         When past the end timestamp, the remaining balance is drained in full.
 *
 * @dev    WETH drips are skipped when `vault.totalSupply() == 0` (no stakers).
 *         In that case `lastDripTimestamp` is NOT updated, so when stakers appear
 *         the accumulated elapsed time produces a proportionally larger drip.
 */
contract DripWCHANRewards is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Tracks the state of a single token distribution stream.
    struct DripStream {
        uint256 startTimestamp;    // when the stream was first configured (or reset)
        uint256 endTimestamp;      // target time by which all tokens should be distributed
        uint256 lastDripTimestamp; // last time tokens were sent to the vault
        uint256 amountRemaining;   // tokens left to drip
    }

    // ── Immutables ──

    /// @notice The WCHANVault that receives dripped tokens.
    IWCHANVault public immutable vault;
    /// @notice WCHAN token (donated via `vault.donate()`).
    IERC20 public immutable wchan;
    /// @notice WETH token (donated via `vault.donateReward()`).
    IERC20 public immutable weth;

    /// @notice Minimum time between permissionless `drip()` calls (per stream).
    uint256 public minDripInterval;

    // ── State ──

    /// @notice Active WCHAN distribution stream.
    DripStream public wchanStream;
    /// @notice Active WETH distribution stream.
    DripStream public wethStream;

    // ── Events ──

    /// @notice Emitted when the owner configures (or tops up) a stream.
    event DripConfigured(bool indexed isWeth, uint256 amount, uint256 endTimestamp);
    /// @notice Emitted when tokens are dripped into the vault.
    event Dripped(bool indexed isWeth, uint256 amount);
    /// @notice Emitted when the owner recovers tokens from this contract.
    event TokensRecovered(address indexed token, address indexed to, uint256 amount);
    /// @notice Emitted when the owner updates the minimum drip interval.
    event MinDripIntervalUpdated(uint256 newInterval);

    // ── Errors ──

    error EndTimestampInPast();
    error ZeroAmount();
    error NothingToDrip();

    constructor(
        address owner_,
        IWCHANVault vault_,
        IERC20 wchan_,
        IERC20 weth_
    ) Ownable(owner_) {
        vault = vault_;
        wchan = wchan_;
        weth = weth_;
        minDripInterval = 1 hours;

        // Max approve vault for both tokens (vault pulls via safeTransferFrom)
        wchan_.approve(address(vault_), type(uint256).max);
        weth_.approve(address(vault_), type(uint256).max);
    }

    // ═══════════════════════════════════════════════
    //              Owner Functions
    // ═══════════════════════════════════════════════

    /**
     * @notice Configure (or top up) a drip stream.
     * @dev    Settles any pending drip first (bypassing the interval check) so
     *         accounting is always clean regardless of when the owner reconfigures.
     *         Amount is additive; endTimestamp only extends, never shortens.
     *         If the stream was fully drained, timestamps are reset to now.
     * @param isWeth       True for the WETH stream, false for WCHAN.
     * @param amount       Tokens to add to the stream (pulled from msg.sender).
     * @param endTimestamp Target end time. Must be in the future. Extended if later
     *                     than the current end; ignored if earlier.
     */
    function configureDrip(bool isWeth, uint256 amount, uint256 endTimestamp) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (endTimestamp <= block.timestamp) revert EndTimestampInPast();

        DripStream storage stream = isWeth ? wethStream : wchanStream;

        // Settle any pending drip (no interval check) so accounting is clean
        _settleDrip(stream, isWeth);

        // Pull tokens from owner
        IERC20 token = isWeth ? weth : wchan;
        token.safeTransferFrom(msg.sender, address(this), amount);

        // If stream is fresh (fully drained after settlement), reset timestamps
        bool isFresh = stream.amountRemaining == 0;
        if (isFresh) {
            stream.startTimestamp = block.timestamp;
            stream.lastDripTimestamp = block.timestamp;
        }

        stream.amountRemaining += amount;

        // Only extend, never shorten
        if (endTimestamp > stream.endTimestamp) {
            stream.endTimestamp = endTimestamp;
        }

        emit DripConfigured(isWeth, amount, stream.endTimestamp);

        // Execute the first drip immediately so rewards go live in this tx.
        // Drip one interval's worth (or everything if duration < interval).
        if (isFresh) {
            uint256 totalDuration = stream.endTimestamp - block.timestamp;
            uint256 firstDrip = totalDuration <= minDripInterval
                ? stream.amountRemaining
                : Math.mulDiv(stream.amountRemaining, minDripInterval, totalDuration);
            if (firstDrip > 0) {
                stream.amountRemaining -= firstDrip;
                // Don't update lastDripTimestamp — it stays at block.timestamp
                // so the next drip() call works after minDripInterval
                if (isWeth) {
                    if (vault.totalSupply() > 0) {
                        vault.donateReward(firstDrip);
                        emit Dripped(true, firstDrip);
                    } else {
                        // No stakers — put tokens back, they'll drip later
                        stream.amountRemaining += firstDrip;
                    }
                } else {
                    vault.donate(firstDrip);
                    emit Dripped(false, firstDrip);
                }
            }
        }
    }

    /**
     * @notice Safety valve: recover any ERC-20 tokens held by this contract.
     * @dev    If the recovered token is WCHAN or WETH, the corresponding stream's
     *         `amountRemaining` is reduced (capped at the current remaining) so that
     *         future drips don't try to send tokens that are no longer here.
     *         Useful for rescuing tokens sent by mistake or adjusting active streams.
     * @param token The ERC-20 token address to recover.
     * @param amount Amount to send to the owner.
     */
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);

        // Reduce stream accounting so future drips don't over-send
        if (token == address(wchan)) {
            wchanStream.amountRemaining -= Math.min(amount, wchanStream.amountRemaining);
        } else if (token == address(weth)) {
            wethStream.amountRemaining -= Math.min(amount, wethStream.amountRemaining);
        }

        emit TokensRecovered(token, owner(), amount);
    }

    /**
     * @notice Update the minimum interval between permissionless `drip()` calls.
     * @param newInterval New interval in seconds (0 = no minimum).
     */
    function setMinDripInterval(uint256 newInterval) external onlyOwner {
        minDripInterval = newInterval;
        emit MinDripIntervalUpdated(newInterval);
    }

    // ═══════════════════════════════════════════════
    //            Permissionless Drip
    // ═══════════════════════════════════════════════

    /**
     * @notice Execute a drip for both streams. Permissionless — anyone can call.
     * @dev    For each stream, requires minDripInterval since the last drip.
     *         WCHAN is always sent via `vault.donate()`.
     *         WETH is sent via `vault.donateReward()` only if `vault.totalSupply() > 0`.
     *         When no stakers exist, WETH is skipped WITHOUT updating lastDripTimestamp,
     *         so the elapsed time keeps growing and self-corrects when stakers appear.
     *         Reverts NothingToDrip if both computed amounts are 0.
     */
    function drip() external {
        uint256 wchanAmount = _computeDripAmount(wchanStream, true);
        uint256 wethAmount = _computeDripAmount(wethStream, true);

        if (wchanAmount == 0 && wethAmount == 0) revert NothingToDrip();

        // ── Effects (update state before external calls — CEI pattern) ──

        if (wchanAmount > 0) {
            wchanStream.amountRemaining -= wchanAmount;
            wchanStream.lastDripTimestamp = block.timestamp;
        }

        // Skip WETH drip if no stakers — don't update lastDripTimestamp
        // so elapsed keeps growing for self-correction.
        // totalSupply() is a view/staticcall, safe to call in effects phase.
        bool dripWeth = wethAmount > 0 && vault.totalSupply() > 0;
        if (dripWeth) {
            wethStream.amountRemaining -= wethAmount;
            wethStream.lastDripTimestamp = block.timestamp;
        }

        // ── Interactions (external calls after all state is finalized) ──

        if (wchanAmount > 0) {
            vault.donate(wchanAmount);
            emit Dripped(false, wchanAmount);
        }
        if (dripWeth) {
            vault.donateReward(wethAmount);
            emit Dripped(true, wethAmount);
        }
    }

    // ═══════════════════════════════════════════════
    //              View Functions
    // ═══════════════════════════════════════════════

    /// @notice Check whether each stream has a non-zero drip ready (interval satisfied).
    function canDrip() external view returns (bool wchanCan, bool wethCan) {
        wchanCan = _computeDripAmount(wchanStream, true) > 0;
        wethCan = _computeDripAmount(wethStream, true) > 0;
    }

    /// @notice Preview the amounts that would be dripped right now.
    function previewDrip() external view returns (uint256 wchanAmount, uint256 wethAmount) {
        wchanAmount = _computeDripAmount(wchanStream, true);
        wethAmount = _computeDripAmount(wethStream, true);
    }

    // ═══════════════════════════════════════════════
    //             Internal Functions
    // ═══════════════════════════════════════════════

    /**
     * @dev Compute how many tokens should be dripped from a stream right now.
     *
     *      Formula (self-correcting linear interpolation):
     *        if amountRemaining == 0         → 0
     *        if now >= endTimestamp           → amountRemaining  (drain everything)
     *        else: amountRemaining × elapsed / remainingDuration
     *
     *      Missed intervals produce a larger `elapsed`, so the next drip catches up
     *      proportionally. Uses Math.mulDiv for 512-bit safe intermediate product.
     *
     * @param stream        The stream to compute for.
     * @param checkInterval If true, returns 0 when elapsed < MIN_DRIP_INTERVAL.
     *                      False is used by _settleDrip (called from configureDrip)
     *                      so settlement is always clean regardless of timing.
     */
    function _computeDripAmount(DripStream storage stream, bool checkInterval) internal view returns (uint256) {
        if (stream.amountRemaining == 0) return 0;

        uint256 elapsed = block.timestamp - stream.lastDripTimestamp;
        if (checkInterval && elapsed < minDripInterval) return 0;

        if (block.timestamp >= stream.endTimestamp) {
            return stream.amountRemaining;
        }

        uint256 remainingDuration = stream.endTimestamp - stream.lastDripTimestamp;
        return Math.mulDiv(stream.amountRemaining, elapsed, remainingDuration);
    }

    /**
     * @dev Settle any pending drip for a stream by computing the amount owed and
     *      forwarding it to the vault. Called by `configureDrip` before modifying
     *      stream state so accounting is always consistent.
     *      For WETH: if no stakers, settlement is skipped entirely (no deduction,
     *      no timestamp update) so tokens remain tracked and self-correct when
     *      stakers appear — mirroring `drip()` behaviour.
     */
    function _settleDrip(DripStream storage stream, bool isWeth) internal {
        uint256 amount = _computeDripAmount(stream, false);
        if (amount == 0) return;

        if (isWeth) {
            if (vault.totalSupply() > 0) {
                stream.amountRemaining -= amount;
                stream.lastDripTimestamp = block.timestamp;
                vault.donateReward(amount);
                emit Dripped(true, amount);
            }
            // No stakers → skip entirely (amount stays, timestamp not updated)
        } else {
            stream.amountRemaining -= amount;
            stream.lastDripTimestamp = block.timestamp;
            vault.donate(amount);
            emit Dripped(false, amount);
        }
    }
}
