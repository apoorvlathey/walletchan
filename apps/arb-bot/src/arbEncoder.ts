import { encodeFunctionData, type Address, type Hex } from "viem";
import {
  getAddresses,
  buildPoolKey,
  buildOldTokenPoolKey,
  buildWrapPoolKey,
  isWethCurrency0,
  isWethCurrency0ForOldToken,
  universalRouterAbi,
  encodeSwapExactInSingle,
  encodeSwapExactIn,
  encodeTakeAll,
  encodeV4Swap,
  encodeSweep,
  MSG_SENDER,
} from "@walletchan/wchan-swap";
import type { ArbDirection } from "./priceComparison.js";
import { config } from "./config.js";
import { applySlippage } from "@walletchan/wchan-swap";

// OLD_TOKEN pool constants (duplicated for path building)
const OLD_TOKEN_POOL_FEE = 0x800000;
const OLD_TOKEN_TICK_SPACING = 200;
const WRAP_POOL_FEE = 0;
const WRAP_TICK_SPACING = 60;

export interface ArbTx {
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * Encode an atomic 2-leg arb transaction via the Universal Router.
 *
 * Zero-capital arb: Net WETH delta is positive (pool owes us WETH),
 * so no SETTLE needed for WETH. V4 handles this within the unlock
 * callback's transient delta accounting.
 *
 * For buy-direct-sell-bnkrw (WCHAN cheaper on direct):
 *   Leg 1: SWAP_EXACT_IN_SINGLE WETH→WCHAN on direct pool
 *   Leg 2: SWAP_EXACT_IN WCHAN→BNKRW→WETH multi-hop (1:1 unwrap + sell)
 *   Then TAKE_ALL WETH + TAKE_ALL WCHAN (dust)
 *
 * For buy-bnkrw-sell-direct (WCHAN cheaper via BNKRW):
 *   Leg 1: SWAP_EXACT_IN WETH→BNKRW→WCHAN multi-hop (buy + 1:1 wrap)
 *   Leg 2: SWAP_EXACT_IN_SINGLE WCHAN→WETH on direct pool
 *   Then TAKE_ALL WETH + TAKE_ALL WCHAN (dust)
 */
export function encodeArbTx(
  direction: ArbDirection,
  amountIn: bigint,
  expectedLeg1Out: bigint,
  expectedLeg2Out: bigint,
  deadline: bigint,
): ArbTx {
  const addrs = getAddresses(config.chainId);
  const wethIs0Direct = isWethCurrency0(config.chainId);
  const wethIs0Bnkrw = isWethCurrency0ForOldToken(config.chainId);

  // Apply slippage to the final WETH output (profit protection)
  const minWethOut = applySlippage(expectedLeg2Out, config.slippageBps);
  // Apply slippage to intermediate amount too
  const minLeg1Out = applySlippage(expectedLeg1Out, config.slippageBps);

  let v4Actions: Hex;
  let v4Params: Hex[];

  if (direction === "buy-direct-sell-bnkrw") {
    // Leg 1: SWAP_EXACT_IN_SINGLE WETH→WCHAN on direct (0x06)
    const leg1 = encodeSwapExactInSingle(
      config.chainId,
      wethIs0Direct, // WETH→WCHAN: zeroForOne = wethIs0
      amountIn,
      minLeg1Out,
    );

    // Leg 2: SWAP_EXACT_IN WCHAN→BNKRW→WETH multi-hop (0x07)
    // Path: WCHAN → [BNKRW via wrap pool] → [WETH via old token pool]
    const leg2 = encodeSwapExactIn(
      addrs.wchan,
      [
        {
          intermediateCurrency: addrs.oldToken,
          fee: WRAP_POOL_FEE,
          tickSpacing: WRAP_TICK_SPACING,
          hooks: addrs.wrapHook,
          hookData: "0x" as Hex,
        },
        {
          intermediateCurrency: addrs.weth,
          fee: OLD_TOKEN_POOL_FEE,
          tickSpacing: OLD_TOKEN_TICK_SPACING,
          hooks: addrs.oldTokenPoolHook,
          hookData: "0x" as Hex,
        },
      ],
      expectedLeg1Out, // Use expected output as input (will be exact from delta)
      minWethOut,
    );

    // TAKE_ALL WETH, TAKE_ALL WCHAN (dust)
    const takeWeth = encodeTakeAll(addrs.weth, 0n);
    const takeWchan = encodeTakeAll(addrs.wchan, 0n);

    // V4 actions: SWAP_EXACT_IN_SINGLE(0x06) SWAP_EXACT_IN(0x07) TAKE_ALL(0x0f) TAKE_ALL(0x0f)
    v4Actions = "0x06070f0f" as Hex;
    v4Params = [leg1, leg2, takeWeth, takeWchan];
  } else {
    // buy-bnkrw-sell-direct

    // Leg 1: SWAP_EXACT_IN WETH→BNKRW→WCHAN multi-hop (0x07)
    // Path: WETH → [BNKRW via old token pool] → [WCHAN via wrap pool]
    const leg1 = encodeSwapExactIn(
      addrs.weth,
      [
        {
          intermediateCurrency: addrs.oldToken,
          fee: OLD_TOKEN_POOL_FEE,
          tickSpacing: OLD_TOKEN_TICK_SPACING,
          hooks: addrs.oldTokenPoolHook,
          hookData: "0x" as Hex,
        },
        {
          intermediateCurrency: addrs.wchan,
          fee: WRAP_POOL_FEE,
          tickSpacing: WRAP_TICK_SPACING,
          hooks: addrs.wrapHook,
          hookData: "0x" as Hex,
        },
      ],
      amountIn,
      minLeg1Out,
    );

    // Leg 2: SWAP_EXACT_IN_SINGLE WCHAN→WETH on direct (0x06)
    const leg2 = encodeSwapExactInSingle(
      config.chainId,
      !wethIs0Direct, // WCHAN→WETH: zeroForOne = !wethIs0
      expectedLeg1Out,
      minWethOut,
    );

    // TAKE_ALL WETH, TAKE_ALL WCHAN (dust)
    const takeWeth = encodeTakeAll(addrs.weth, 0n);
    const takeWchan = encodeTakeAll(addrs.wchan, 0n);

    // V4 actions: SWAP_EXACT_IN(0x07) SWAP_EXACT_IN_SINGLE(0x06) TAKE_ALL(0x0f) TAKE_ALL(0x0f)
    v4Actions = "0x07060f0f" as Hex;
    v4Params = [leg1, leg2, takeWeth, takeWchan];
  }

  const v4SwapInput = encodeV4Swap(v4Actions, v4Params);

  // UR commands: V4_SWAP(0x10) + SWEEP(WETH, 0x04) + SWEEP(WCHAN, 0x04)
  const commands = "0x100404" as Hex;
  const sweepWeth = encodeSweep(addrs.weth, MSG_SENDER, 0n);
  const sweepWchan = encodeSweep(addrs.wchan, MSG_SENDER, 0n);

  const data = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, [v4SwapInput, sweepWeth, sweepWchan], deadline],
  });

  return {
    to: addrs.universalRouter,
    data,
    value: 0n, // Zero capital arb — no ETH needed
  };
}
