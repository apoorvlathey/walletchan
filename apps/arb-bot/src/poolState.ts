import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import {
  getAddresses,
  buildPoolKey,
  buildOldTokenPoolKey,
  type PoolKey,
} from "@bankr-wallet/wchan-swap";
import { config } from "./config.js";

// PoolManager storage: mapping(PoolId => Pool.State) at slot 6
const POOLS_SLOT = 6n;

export interface PoolSlot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface PoolStates {
  direct: PoolSlot0;
  bnkrw: PoolSlot0;
}

const poolManagerAbi = [
  {
    name: "extsload",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "slot", type: "bytes32" }],
    outputs: [{ name: "value", type: "bytes32" }],
  },
] as const;

function encodePoolId(poolKey: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address", name: "currency0" },
        { type: "address", name: "currency1" },
        { type: "uint24", name: "fee" },
        { type: "int24", name: "tickSpacing" },
        { type: "address", name: "hooks" },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    )
  );
}

function getSlot0Key(poolId: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [poolId, POOLS_SLOT]
    )
  );
}

function decodeSlot0(raw: Hex): PoolSlot0 {
  const val = BigInt(raw);
  const sqrtPriceX96 = val & ((1n << 160n) - 1n);
  const tickRaw = Number((val >> 160n) & ((1n << 24n) - 1n));
  const tick = tickRaw >= 0x800000 ? tickRaw - 0x1000000 : tickRaw;
  const protocolFee = Number((val >> 184n) & ((1n << 24n) - 1n));
  const lpFee = Number((val >> 208n) & ((1n << 24n) - 1n));

  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

// --- Pre-computed constants (computed once at module load) ---

const addrs = getAddresses(config.chainId);
const directPoolId = encodePoolId(buildPoolKey(config.chainId));
const bnkrwPoolId = encodePoolId(buildOldTokenPoolKey(config.chainId));
const directSlot0Key = getSlot0Key(directPoolId);
const bnkrwSlot0Key = getSlot0Key(bnkrwPoolId);

// Pre-encode the extsload calldata (constant per pool)
const directExtsloadData = encodeFunctionData({
  abi: poolManagerAbi,
  functionName: "extsload",
  args: [directSlot0Key],
});
const bnkrwExtsloadData = encodeFunctionData({
  abi: poolManagerAbi,
  functionName: "extsload",
  args: [bnkrwSlot0Key],
});

/**
 * Read both pool slot0 states in a single JSON-RPC batch request.
 * Uses raw fetch instead of viem multicall for minimal overhead.
 */
export async function readPoolStates(): Promise<PoolStates> {
  const rpcRequests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        { to: addrs.poolManager, data: directExtsloadData },
        "latest",
      ],
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_call",
      params: [
        { to: addrs.poolManager, data: bnkrwExtsloadData },
        "latest",
      ],
    },
  ];

  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rpcRequests),
  });

  const results = (await response.json()) as Array<{
    id: number;
    result?: string;
    error?: { message: string };
  }>;

  results.sort((a, b) => a.id - b.id);

  if (results[0].error || !results[0].result) {
    throw new Error(`Direct pool read failed: ${results[0].error?.message}`);
  }
  if (results[1].error || !results[1].result) {
    throw new Error(`BNKRW pool read failed: ${results[1].error?.message}`);
  }

  const direct = decodeSlot0(results[0].result as Hex);
  const bnkrw = decodeSlot0(results[1].result as Hex);

  return { direct, bnkrw };
}
