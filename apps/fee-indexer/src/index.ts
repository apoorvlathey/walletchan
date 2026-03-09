import { ponder } from "ponder:registry";
import {
  keccak256,
  encodeAbiParameters,
  encodePacked,
  type Address,
} from "viem";
import { clankerClaim, hookClaim, v4Claim } from "../ponder.schema";

const CLANKER_FEE_OWNER = "0x74992be74bc3c3A72E97dF34A2C3A62c15f55970";
const WETH = "0x4200000000000000000000000000000000000006";
const BNKRW = "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07";

// V4 constants
const POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b" as Address;
const POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as Address;
const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as Address;
const WCHAN = "0xBa5ED0000e1CA9136a695f0a848012A16008B032" as Address;
const TOKEN_ID = 1956399n;
const POOL_ID =
  "0x81C7A2A2C33EA285F062C5AC0C4E3D4FFB2F6FD2588BBD354D0D3AF8A58B6337" as `0x${string}`;
const UINT256_MAX = (1n << 256n) - 1n;

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

// Only index ClaimTokens where feeOwner is ours and token is WETH or BNKRW
ponder.on("ClankerFeeLocker:ClaimTokens", async ({ event, context }) => {
  if (
    event.args.feeOwner.toLowerCase() !== CLANKER_FEE_OWNER.toLowerCase() ||
    (event.args.token.toLowerCase() !== WETH.toLowerCase() &&
      event.args.token.toLowerCase() !== BNKRW.toLowerCase())
  ) {
    return;
  }

  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(clankerClaim)
    .values({
      id,
      token: event.args.token,
      amount: event.args.amountClaimed,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

// Index all WethClaimed events
ponder.on("WCHANDevFeeHook:WethClaimed", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(hookClaim)
    .values({
      id,
      dev: event.args.dev,
      amount: event.args.amount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

// V4 LP fee claims — ModifyLiquidity with liquidityDelta === 0 means fee-only collect
ponder.on("PoolManager:ModifyLiquidity", async ({ event, context }) => {
  // Only index fee-only claims (liquidityDelta === 0)
  if (event.args.liquidityDelta !== 0n) return;

  const { tickLower, tickUpper } = event.args;

  // Get WCHAN amount from ERC20 Transfer log in the tx receipt
  let wchanAmount = 0n;
  const receipt = await context.client.getTransactionReceipt({
    hash: event.transaction.hash,
  });
  const transferTopic = keccak256(
    new TextEncoder().encode("Transfer(address,address,uint256)")
  );
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === WCHAN.toLowerCase() &&
      log.topics[0] === transferTopic &&
      log.topics.length >= 3
    ) {
      // from = PoolManager
      const from = `0x${log.topics[1]!.slice(26)}`.toLowerCase();
      if (from === POOL_MANAGER.toLowerCase()) {
        wchanAmount = BigInt(log.data);
        break;
      }
    }
  }

  // Get ETH amount from fee growth math at blockNumber - 1
  let ethAmount = 0n;
  try {
    const prevBlock = event.block.number - 1n;
    const positionKey = computePositionKey(
      POSITION_MANAGER,
      tickLower,
      tickUpper,
      TOKEN_ID
    );

    const [feeGrowthResult, posInfoResult] = await Promise.all([
      context.client.readContract({
        address: STATE_VIEW,
        abi: stateViewAbi,
        functionName: "getFeeGrowthInside",
        args: [POOL_ID, tickLower, tickUpper],
        blockNumber: prevBlock,
      }),
      context.client.readContract({
        address: STATE_VIEW,
        abi: stateViewAbi,
        functionName: "getPositionInfo",
        args: [POOL_ID, positionKey],
        blockNumber: prevBlock,
      }),
    ]);

    const [feeGrowthInside0, _feeGrowthInside1] = feeGrowthResult;
    const [liquidity, feeGrowthInside0Last, _feeGrowthInside1Last] = posInfoResult;

    if (liquidity > 0n) {
      // currency0 = ETH — unchecked uint256 subtraction
      const diff0 = (feeGrowthInside0 - feeGrowthInside0Last) & UINT256_MAX;
      ethAmount = (diff0 * liquidity) >> 128n;
    }
  } catch (err) {
    console.error("Failed to compute V4 ETH fees:", err);
  }

  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(v4Claim)
    .values({
      id,
      ethAmount,
      wchanAmount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});
