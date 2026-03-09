import { useReadContracts } from "wagmi";
import {
  keccak256,
  encodeAbiParameters,
  encodePacked,
  type Address,
} from "viem";
import { ADDRESSES } from "@/lib/wchan-swap/addresses";

const BASE_CHAIN_ID = 8453;
const TOKEN_ID = 1956399n;
const POSITION_MANAGER = ADDRESSES[BASE_CHAIN_ID].positionManager as Address;
const STATE_VIEW = ADDRESSES[BASE_CHAIN_ID].stateView as Address;
const WCHAN = ADDRESSES[BASE_CHAIN_ID].wchan as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const FEES_POLL_MS = 5_000;

// Action codes from Uniswap V4 Actions.sol
const DECREASE_LIQUIDITY = 0x01;
const CLOSE_CURRENCY = 0x12;

// Minimal ABIs
const positionManagerAbi = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPoolAndPositionInfo",
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPositionLiquidity",
    outputs: [{ name: "liquidity", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    name: "modifyLiquidities",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const stateViewAbi = [
  {
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
    ],
    name: "getFeeGrowthInside",
    outputs: [
      { name: "feeGrowthInside0X128", type: "uint256" },
      { name: "feeGrowthInside1X128", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "positionId", type: "bytes32" },
    ],
    name: "getPositionInfo",
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Decode PositionInfo bytes32 (Uniswap V4 PositionInfoLibrary layout):
// [0:7] hasSubscriber | [8:31] tickLower(int24) | [32:55] tickUpper(int24) | [56:255] poolId(25 bytes)
function decodePositionInfo(info: `0x${string}`) {
  const n = BigInt(info);
  const rawLower = Number((n >> 8n) & 0xffffffn);
  const rawUpper = Number((n >> 32n) & 0xffffffn);
  // sign-extend int24
  const tickLower = rawLower >= 0x800000 ? rawLower - 0x1000000 : rawLower;
  const tickUpper = rawUpper >= 0x800000 ? rawUpper - 0x1000000 : rawUpper;
  return { tickLower, tickUpper };
}

type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

function computePoolId(key: PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    )
  );
}

function computePositionKey(
  owner: Address,
  tickLower: number,
  tickUpper: number,
  salt: bigint
): `0x${string}` {
  const saltBytes32 = `0x${salt.toString(16).padStart(64, "0")}` as `0x${string}`;
  return keccak256(
    encodePacked(
      ["address", "int24", "int24", "bytes32"],
      [owner, tickLower, tickUpper, saltBytes32]
    )
  );
}

const UINT256_MAX = (1n << 256n) - 1n;

/** Build the calldata for collecting V4 LP fees (DECREASE_LIQUIDITY with 0 delta + CLOSE_CURRENCY) */
function buildClaimCalldata(): { unlockData: `0x${string}`; deadline: bigint } {
  // actions: DECREASE_LIQUIDITY, CLOSE_CURRENCY(currency0), CLOSE_CURRENCY(currency1)
  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [DECREASE_LIQUIDITY, CLOSE_CURRENCY, CLOSE_CURRENCY]
  );

  const decreaseParams = encodeAbiParameters(
    [
      { type: "uint256" }, // tokenId
      { type: "uint256" }, // liquidity (0 = collect fees only)
      { type: "uint128" }, // amount0Min
      { type: "uint128" }, // amount1Min
      { type: "bytes" },   // hookData
    ],
    [TOKEN_ID, 0n, 0n, 0n, "0x"]
  );

  const closeParams0 = encodeAbiParameters(
    [{ type: "address" }],
    [ZERO_ADDRESS] // currency0 = ETH
  );

  const closeParams1 = encodeAbiParameters(
    [{ type: "address" }],
    [WCHAN] // currency1 = WCHAN
  );

  const unlockData = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [decreaseParams, closeParams0, closeParams1]]
  );

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes

  return { unlockData, deadline };
}

export { POSITION_MANAGER, positionManagerAbi, buildClaimCalldata, BASE_CHAIN_ID as V4_CHAIN_ID };

export function useV4PositionFees() {
  // Call 1: get pool key, position info, and liquidity
  const {
    data: call1Data,
    isLoading: call1Loading,
    refetch: refetchCall1,
  } = useReadContracts({
    contracts: [
      {
        address: POSITION_MANAGER,
        abi: positionManagerAbi,
        functionName: "getPoolAndPositionInfo",
        args: [TOKEN_ID],
        chainId: BASE_CHAIN_ID,
      },
      {
        address: POSITION_MANAGER,
        abi: positionManagerAbi,
        functionName: "getPositionLiquidity",
        args: [TOKEN_ID],
        chainId: BASE_CHAIN_ID,
      },
    ],
    query: { refetchInterval: FEES_POLL_MS },
  });

  const poolAndPosResult = call1Data?.[0];
  const liquidityResult = call1Data?.[1];

  let tickLower: number | undefined;
  let tickUpper: number | undefined;
  let poolId: `0x${string}` | undefined;
  let positionKey: `0x${string}` | undefined;
  let liquidity: bigint | undefined;

  if (
    poolAndPosResult?.status === "success" &&
    liquidityResult?.status === "success"
  ) {
    const [key, posInfo] = poolAndPosResult.result as [PoolKey, `0x${string}`];
    const decoded = decodePositionInfo(posInfo);
    tickLower = decoded.tickLower;
    tickUpper = decoded.tickUpper;
    poolId = computePoolId(key);
    positionKey = computePositionKey(POSITION_MANAGER, tickLower, tickUpper, TOKEN_ID);
    liquidity = liquidityResult.result as bigint;
  }

  const call2Ready =
    poolId !== undefined &&
    tickLower !== undefined &&
    tickUpper !== undefined &&
    positionKey !== undefined;

  // Call 2: fee growth + position's last fee growth
  const {
    data: call2Data,
    isLoading: call2Loading,
    refetch: refetchCall2,
  } = useReadContracts({
    contracts: call2Ready
      ? [
          {
            address: STATE_VIEW,
            abi: stateViewAbi,
            functionName: "getFeeGrowthInside",
            args: [poolId!, tickLower!, tickUpper!],
            chainId: BASE_CHAIN_ID,
          },
          {
            address: STATE_VIEW,
            abi: stateViewAbi,
            functionName: "getPositionInfo",
            args: [poolId!, positionKey!],
            chainId: BASE_CHAIN_ID,
          },
        ]
      : undefined,
    query: {
      enabled: call2Ready,
      refetchInterval: FEES_POLL_MS,
    },
  });

  let ethFees: bigint | undefined;
  let wchanFees: bigint | undefined;

  if (call2Data) {
    const feeGrowthResult = call2Data[0];
    const posInfoResult = call2Data[1];

    if (
      feeGrowthResult?.status === "success" &&
      posInfoResult?.status === "success" &&
      liquidity !== undefined &&
      liquidity > 0n
    ) {
      const [feeGrowthInside0, feeGrowthInside1] = feeGrowthResult.result as [bigint, bigint];
      const [, feeGrowthInside0Last, feeGrowthInside1Last] = posInfoResult.result as [
        bigint,
        bigint,
        bigint,
      ];

      // unchecked uint256 subtraction (matches Solidity behavior)
      const diff0 = (feeGrowthInside0 - feeGrowthInside0Last) & UINT256_MAX;
      const diff1 = (feeGrowthInside1 - feeGrowthInside1Last) & UINT256_MAX;

      // currency0 = ETH (address(0)), currency1 = WCHAN
      ethFees = (diff0 * liquidity) >> 128n;
      wchanFees = (diff1 * liquidity) >> 128n;
    }
  }

  const isLoading = call1Loading || (call2Ready && call2Loading);
  const hasClaimable =
    (ethFees !== undefined && ethFees > 0n) ||
    (wchanFees !== undefined && wchanFees > 0n);

  const refetch = () => {
    refetchCall1();
    refetchCall2();
  };

  return { ethFees, wchanFees, isLoading, hasClaimable, refetch };
}
