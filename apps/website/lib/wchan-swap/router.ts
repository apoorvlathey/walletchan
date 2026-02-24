import {
  encodeAbiParameters,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { universalRouterAbi } from "./abis";
import { getAddresses } from "./addresses";
import { buildPoolKey, isWethCurrency0 } from "./poolKey";
import type { PermitSingleData } from "./permit2";

// Special addresses used by Universal Router
const ADDRESS_THIS = "0x0000000000000000000000000000000000000002" as Address;
const MSG_SENDER = "0x0000000000000000000000000000000000000001" as Address;
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

// --- ABI parameter type definitions ---

const poolKeyTuple = {
  type: "tuple" as const,
  name: "poolKey" as const,
  components: [
    { type: "address" as const, name: "currency0" as const },
    { type: "address" as const, name: "currency1" as const },
    { type: "uint24" as const, name: "fee" as const },
    { type: "int24" as const, name: "tickSpacing" as const },
    { type: "address" as const, name: "hooks" as const },
  ],
};

const exactInputSingleParamsType = [
  {
    type: "tuple" as const,
    components: [
      poolKeyTuple,
      { type: "bool" as const, name: "zeroForOne" as const },
      { type: "uint128" as const, name: "amountIn" as const },
      { type: "uint128" as const, name: "amountOutMinimum" as const },
      { type: "bytes" as const, name: "hookData" as const },
    ],
  },
] as const;

// --- Encoding helpers ---

function encodeSwapExactInSingle(
  chainId: number,
  zeroForOne: boolean,
  amountIn: bigint,
  minAmountOut: bigint
): Hex {
  const poolKey = buildPoolKey(chainId);
  return encodeAbiParameters(exactInputSingleParamsType, [
    {
      poolKey: {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountIn,
      amountOutMinimum: minAmountOut,
      hookData: "0x",
    },
  ]);
}

function encodeSettle(
  currency: Address,
  maxAmount: bigint,
  payerIsUser: boolean
): Hex {
  return encodeAbiParameters(
    [
      { type: "address" as const },
      { type: "uint256" as const },
      { type: "bool" as const },
    ],
    [currency, maxAmount, payerIsUser]
  );
}

function encodeSettleAll(currency: Address, maxAmount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" as const }, { type: "uint256" as const }],
    [currency, maxAmount]
  );
}

function encodeTake(
  currency: Address,
  recipient: Address,
  minAmount: bigint
): Hex {
  return encodeAbiParameters(
    [
      { type: "address" as const },
      { type: "address" as const },
      { type: "uint256" as const },
    ],
    [currency, recipient, minAmount]
  );
}

function encodeTakeAll(currency: Address, minAmount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" as const }, { type: "uint256" as const }],
    [currency, minAmount]
  );
}

function encodeV4Swap(actions: Hex, params: Hex[]): Hex {
  return encodeAbiParameters(
    [{ type: "bytes" as const }, { type: "bytes[]" as const }],
    [actions, params]
  );
}

function encodeWrapEth(recipient: Address, amount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" as const }, { type: "uint256" as const }],
    [recipient, amount]
  );
}

function encodeUnwrapWeth(recipient: Address, minAmount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" as const }, { type: "uint256" as const }],
    [recipient, minAmount]
  );
}

function encodeSweep(
  token: Address,
  recipient: Address,
  amountMin: bigint
): Hex {
  return encodeAbiParameters(
    [
      { type: "address" as const },
      { type: "address" as const },
      { type: "uint256" as const },
    ],
    [token, recipient, amountMin]
  );
}

function encodePermit2PermitCommand(
  permitSingle: PermitSingleData,
  signature: Hex
): Hex {
  return encodeAbiParameters(
    [
      {
        type: "tuple" as const,
        components: [
          {
            type: "tuple" as const,
            name: "details" as const,
            components: [
              { type: "address" as const, name: "token" as const },
              { type: "uint160" as const, name: "amount" as const },
              { type: "uint48" as const, name: "expiration" as const },
              { type: "uint48" as const, name: "nonce" as const },
            ],
          },
          { type: "address" as const, name: "spender" as const },
          { type: "uint256" as const, name: "sigDeadline" as const },
        ],
      },
      { type: "bytes" as const },
    ],
    [
      {
        details: {
          token: permitSingle.details.token,
          amount: permitSingle.details.amount,
          expiration: permitSingle.details.expiration,
          nonce: permitSingle.details.nonce,
        },
        spender: permitSingle.spender,
        sigDeadline: permitSingle.sigDeadline,
      },
      signature,
    ]
  );
}

// --- Public encoding functions ---

/**
 * Buy WCHAN with ETH.
 * UR Commands: WRAP_ETH → V4_SWAP → SWEEP
 * V4 Actions: SWAP_EXACT_IN_SINGLE → SETTLE → TAKE_ALL
 */
export function encodeBuyWchan(
  chainId: number,
  amountIn: bigint,
  minAmountOut: bigint,
  deadline: bigint
): { to: Address; data: Hex; value: bigint } {
  const addrs = getAddresses(chainId);
  const wethIs0 = isWethCurrency0(chainId);
  // Buy WCHAN = sell WETH for WCHAN
  const zeroForOne = wethIs0; // true if WETH is currency0

  // V4 actions: SWAP_EXACT_IN_SINGLE(0x06), SETTLE(0x0b), TAKE_ALL(0x0f)
  const v4Actions = "0x060b0f" as Hex;
  const swapParams = encodeSwapExactInSingle(
    chainId,
    zeroForOne,
    amountIn,
    minAmountOut
  );
  const settleParams = encodeSettle(addrs.weth, amountIn, false);
  const takeAllParams = encodeTakeAll(addrs.wchan, minAmountOut);
  const v4SwapInput = encodeV4Swap(v4Actions, [
    swapParams,
    settleParams,
    takeAllParams,
  ]);

  // UR: WRAP_ETH(0x0b), V4_SWAP(0x10), SWEEP(0x04)
  const commands = "0x0b1004" as Hex;
  const wrapInput = encodeWrapEth(ADDRESS_THIS, amountIn);
  const sweepInput = encodeSweep(ETH_ADDRESS, MSG_SENDER, 0n);

  const data = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, [wrapInput, v4SwapInput, sweepInput], deadline],
  });

  return { to: addrs.universalRouter, data, value: amountIn };
}

/**
 * Sell WCHAN for ETH.
 * UR Commands: [PERMIT2_PERMIT?] → V4_SWAP → UNWRAP_WETH → SWEEP
 * V4 Actions: SWAP_EXACT_IN_SINGLE → SETTLE_ALL → TAKE
 */
export function encodeSellWchan(
  chainId: number,
  amountIn: bigint,
  minAmountOut: bigint,
  deadline: bigint,
  permit?: { permitSingle: PermitSingleData; signature: Hex }
): { to: Address; data: Hex; value: bigint } {
  const addrs = getAddresses(chainId);
  const wethIs0 = isWethCurrency0(chainId);
  // Sell WCHAN = sell WCHAN for WETH
  const zeroForOne = !wethIs0; // true if WCHAN is currency0

  // V4 actions: SWAP_EXACT_IN_SINGLE(0x06), SETTLE_ALL(0x0c), TAKE(0x0e)
  const v4Actions = "0x060c0e" as Hex;
  const swapParams = encodeSwapExactInSingle(
    chainId,
    zeroForOne,
    amountIn,
    minAmountOut
  );
  const settleAllParams = encodeSettleAll(addrs.wchan, amountIn);
  // Use OPEN_DELTA (0) to take the full WETH output; slippage enforced by UNWRAP_WETH
  const takeParams = encodeTake(addrs.weth, ADDRESS_THIS, 0n);
  const v4SwapInput = encodeV4Swap(v4Actions, [
    swapParams,
    settleAllParams,
    takeParams,
  ]);

  const unwrapInput = encodeUnwrapWeth(MSG_SENDER, minAmountOut);
  const sweepInput = encodeSweep(addrs.weth, MSG_SENDER, 0n);

  let commands: Hex;
  let inputs: Hex[];

  if (permit) {
    // PERMIT2_PERMIT(0x0a) → V4_SWAP(0x10) → UNWRAP_WETH(0x0c) → SWEEP(0x04)
    const permitInput = encodePermit2PermitCommand(
      permit.permitSingle,
      permit.signature
    );
    commands = "0x0a100c04" as Hex;
    inputs = [permitInput, v4SwapInput, unwrapInput, sweepInput];
  } else {
    // V4_SWAP(0x10) → UNWRAP_WETH(0x0c) → SWEEP(0x04)
    commands = "0x100c04" as Hex;
    inputs = [v4SwapInput, unwrapInput, sweepInput];
  }

  const data = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, inputs, deadline],
  });

  return { to: addrs.universalRouter, data, value: 0n };
}
