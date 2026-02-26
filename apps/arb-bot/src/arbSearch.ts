import { encodeFunctionData, decodeAbiParameters, formatEther } from "viem";
import {
  getAddresses,
  buildPoolKey,
  buildOldTokenPoolKey,
  isWethCurrency0,
  isWethCurrency0ForOldToken,
  quoterAbi,
} from "@walletchan/wchan-swap";
import type { ArbDirection } from "./priceComparison.js";
import { config } from "./config.js";
import { log } from "./logger.js";

export interface ArbResult {
  direction: ArbDirection;
  amountIn: bigint; // WETH input for leg 1
  leg1Out: bigint; // WCHAN/BNKRW output from leg 1
  leg2Out: bigint; // WETH output from leg 2
  profit: bigint; // leg2Out - amountIn
}

const RETURN_TYPES = [
  { type: "uint256" as const, name: "amountOut" as const },
  { type: "uint256" as const, name: "gasEstimate" as const },
] as const;

// --- Pre-computed constants (computed once at module load) ---

const addrs = getAddresses(config.chainId);
const directPoolKey = buildPoolKey(config.chainId);
const bnkrwPoolKey = buildOldTokenPoolKey(config.chainId);
const wethIs0Direct = isWethCurrency0(config.chainId);
const wethIs0Bnkrw = isWethCurrency0ForOldToken(config.chainId);

// Pre-encode the static parts of quoter calldata (pool key + zeroForOne direction)
// Only the `exactAmount` changes per quote, so we build partial templates

interface QuoteTemplate {
  to: string;
  pool: typeof directPoolKey;
  zeroForOne: boolean;
}

const templates: Record<
  ArbDirection,
  { leg1: QuoteTemplate; leg2ZeroForOne: boolean; leg2Pool: "direct" | "bnkrw" }
> = {
  "buy-direct-sell-bnkrw": {
    leg1: { to: addrs.quoter, pool: directPoolKey, zeroForOne: wethIs0Direct },
    leg2ZeroForOne: !wethIs0Bnkrw,
    leg2Pool: "bnkrw",
  },
  "buy-bnkrw-sell-direct": {
    leg1: { to: addrs.quoter, pool: bnkrwPoolKey, zeroForOne: wethIs0Bnkrw },
    leg2ZeroForOne: !wethIs0Direct,
    leg2Pool: "direct",
  },
};

/** Encode quoter calldata for a specific amount */
function encodeQuote(
  pool: typeof directPoolKey,
  zeroForOne: boolean,
  amount: bigint,
): string {
  return encodeFunctionData({
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: {
          currency0: pool.currency0,
          currency1: pool.currency1,
          fee: pool.fee,
          tickSpacing: pool.tickSpacing,
          hooks: pool.hooks,
        },
        zeroForOne,
        exactAmount: amount,
        hookData: "0x",
      },
    ],
  });
}

/** Execute a batch of eth_call requests in a single HTTP request */
async function batchQuote(
  calls: Array<{ to: string; data: string }>,
): Promise<(bigint | null)[]> {
  if (calls.length === 0) return [];

  const rpcRequests = calls.map((call, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_call",
    params: [{ to: call.to, data: call.data }, "latest"],
  }));

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

  // Sort by id to maintain order
  results.sort((a, b) => a.id - b.id);

  return results.map((r, i) => {
    if (r.error || !r.result || r.result === "0x") {
      if (r.error) {
        log.debug(`Quote ${i} reverted: ${r.error.message}`);
      }
      return null;
    }
    try {
      const [amountOut] = decodeAbiParameters(
        RETURN_TYPES,
        r.result as `0x${string}`,
      );
      return amountOut;
    } catch {
      return null;
    }
  });
}

/** Generate 10 log-spaced candidate amounts from 0.0001 ETH to 10 ETH */
function generateCandidates(): bigint[] {
  const minExp = -4; // 0.0001 ETH
  const maxExp = 1; // 10 ETH
  const candidates: bigint[] = [];
  for (let i = 0; i < 10; i++) {
    const exp = minExp + (maxExp - minExp) * (i / 9);
    const ethAmount = Math.pow(10, exp);
    const wei = BigInt(Math.floor(ethAmount * 1e18));
    candidates.push(wei);
  }
  return candidates;
}

/**
 * Simulate multiple 2-leg arbs in batch: all leg1 quotes in 1 HTTP request,
 * then all leg2 quotes in 1 HTTP request.
 * Returns array of {leg1Out, leg2Out, profit} or null for failed quotes.
 */
async function batchSimulateArbs(
  direction: ArbDirection,
  amounts: bigint[],
): Promise<({ leg1Out: bigint; leg2Out: bigint; profit: bigint } | null)[]> {
  const tmpl = templates[direction];
  const leg2Pool = tmpl.leg2Pool === "direct" ? directPoolKey : bnkrwPoolKey;

  // Phase 1: Batch all leg1 quotes in a single HTTP request
  const leg1Calls = amounts.map((amount) => ({
    to: tmpl.leg1.to,
    data: encodeQuote(tmpl.leg1.pool, tmpl.leg1.zeroForOne, amount),
  }));

  const leg1Results = await batchQuote(leg1Calls);

  const leg1Successes = leg1Results.filter((r) => r !== null).length;
  log.debug(`Leg1 results: ${leg1Successes}/${amounts.length} succeeded`);

  // Phase 2: Build leg2 calls only for successful leg1 results
  const leg2Indices: number[] = [];
  const leg2Calls: Array<{ to: string; data: string }> = [];

  for (let i = 0; i < leg1Results.length; i++) {
    const leg1Out = leg1Results[i];
    if (leg1Out && leg1Out > 0n) {
      leg2Indices.push(i);
      leg2Calls.push({
        to: addrs.quoter,
        data: encodeQuote(leg2Pool, tmpl.leg2ZeroForOne, leg1Out),
      });
    }
  }

  const leg2Results = leg2Calls.length > 0 ? await batchQuote(leg2Calls) : [];

  const leg2Successes = leg2Results.filter((r) => r !== null).length;
  log.debug(`Leg2 results: ${leg2Successes}/${leg2Calls.length} succeeded`);

  // Assemble results
  const results: ({
    leg1Out: bigint;
    leg2Out: bigint;
    profit: bigint;
  } | null)[] = new Array(amounts.length).fill(null);

  for (let j = 0; j < leg2Indices.length; j++) {
    const i = leg2Indices[j];
    const leg1Out = leg1Results[i]!;
    const leg2Out = leg2Results[j];
    if (leg2Out && leg2Out > 0n) {
      results[i] = {
        leg1Out,
        leg2Out,
        profit: leg2Out - amounts[i],
      };
    }
  }

  return results;
}

/**
 * Find the optimal arb amount via coarse search + ternary refinement.
 *
 * Optimized: All quotes per phase are batched into minimal HTTP requests.
 * Coarse phase: 2 HTTP requests (1 for all leg1, 1 for all leg2)
 * Ternary phase: 2 HTTP requests per iteration (both candidates batched)
 */
export async function findOptimalArb(
  direction: ArbDirection,
): Promise<ArbResult | null> {
  const candidates = generateCandidates();

  // Coarse phase: batch all 10 candidates → 2 HTTP requests total
  const coarseResults = await batchSimulateArbs(direction, candidates);

  // Find the most profitable candidate
  let bestIdx = -1;
  let bestProfit = 0n;
  for (let i = 0; i < coarseResults.length; i++) {
    const r = coarseResults[i];
    if (r && r.profit > bestProfit) {
      bestProfit = r.profit;
      bestIdx = i;
    }
  }

  if (bestIdx === -1 || bestProfit <= 0n) {
    // Log profits for diagnostics (first 3 candidates)
    const sampleProfits = coarseResults
      .slice(0, 3)
      .map((r, i) =>
        r
          ? `${formatEther(candidates[i])}ETH→profit:${formatEther(r.profit)}`
          : `${formatEther(candidates[i])}ETH→null`,
      )
      .join(", ");
    log.info(
      `No profitable candidate in coarse search. Samples: [${sampleProfits}]`,
    );
    return null;
  }

  log.debug(
    `Coarse best: index=${bestIdx} amount=${candidates[bestIdx]} profit=${bestProfit}`,
  );

  // Ternary refinement around the best candidate
  let lo = bestIdx > 0 ? candidates[bestIdx - 1] : candidates[bestIdx] / 2n;
  let hi =
    bestIdx < candidates.length - 1
      ? candidates[bestIdx + 1]
      : candidates[bestIdx] * 2n;

  let bestResult = coarseResults[bestIdx]!;
  let bestAmount = candidates[bestIdx];

  for (let iter = 0; iter < 15; iter++) {
    const range = hi - lo;
    if (range < 10000000000000n) break; // < 0.00001 ETH precision

    const m1 = lo + range / 3n;
    const m2 = hi - range / 3n;

    // Batch both m1 and m2 in a single batchSimulateArbs call → 2 HTTP requests
    const [r1, r2] = await batchSimulateArbs(direction, [m1, m2]);

    const p1 = r1?.profit ?? -1n;
    const p2 = r2?.profit ?? -1n;

    if (p1 > p2) {
      hi = m2;
      if (r1 && p1 > bestResult.profit) {
        bestResult = r1;
        bestAmount = m1;
      }
    } else {
      lo = m1;
      if (r2 && p2 > bestResult.profit) {
        bestResult = r2;
        bestAmount = m2;
      }
    }
  }

  if (bestResult.profit <= 0n) return null;

  return {
    direction,
    amountIn: bestAmount,
    leg1Out: bestResult.leg1Out,
    leg2Out: bestResult.leg2Out,
    profit: bestResult.profit,
  };
}
