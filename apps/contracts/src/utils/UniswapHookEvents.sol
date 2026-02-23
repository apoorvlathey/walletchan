// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from '@uniswap/v4-core/src/types/PoolId.sol';
import {SafeCast} from '@uniswap/v4-core/src/libraries/SafeCast.sol';


/**
 * Defines the events expected by the Uniswap V4 data community for custom hook swaps / fees.
 *
 * @dev https://uniswapfoundation.mirror.xyz/KGKMZ2Gbc_I8IqySVUMrEenZxPnVnH9-Qe4BlN1qn0g
 */
library UniswapHookEvents {

    using SafeCast for int;
    using SafeCast for uint;

    event HookSwap(
        bytes32 indexed id,       // v4 pool id
        address indexed sender,   // router of the swap
        int128 amount0,
        int128 amount1,
        uint128 hookLPfeeAmount0,
        uint128 hookLPfeeAmount1
    );

    event HookFee(
        bytes32 indexed id,       // v4 pool id
        address indexed sender,   // router of the swap
        uint128 feeAmount0,
        uint128 feeAmount1
    );

    function emitHookSwapEvent(PoolId _poolId, address _sender, int _amount0, int _amount1, int _fee0, int _fee1) internal {
        // If we have swap amounts, then `HookSwap` should be fired
        if (_amount0 != 0 || _amount1 != 0) {
            emit HookSwap({
                id: PoolId.unwrap(_poolId),
                sender: _sender,
                amount0: _amount0.toInt128(),
                amount1: _amount1.toInt128(),
                hookLPfeeAmount0: 0,
                hookLPfeeAmount1: 0
            });
        }

        // If we have swap fees, then `HookFee` should be fired
        if (_fee0 != 0 || _fee1 != 0) {
            emit HookFee({
                id: PoolId.unwrap(_poolId),
                sender: _sender,
                feeAmount0: uint(-_fee0).toUint128(),
                feeAmount1: uint(-_fee1).toUint128()
            });
        }
    }

}
