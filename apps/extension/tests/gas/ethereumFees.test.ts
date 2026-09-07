import assert from "node:assert/strict";
import test from "node:test";
import { estimateFeeTiers } from "../../src/chrome/gas/feeEstimator";
import { getPriorityFeeFloor } from "../../src/chrome/gas/feePolicy";
import { recommendReplacementFees } from "../../src/chrome/transactions/replacementPolicy";
import { formatGwei } from "../../src/lib/gasFormatUtils";

function client(history: unknown, rpcTip: unknown = "0x186a0") {
  return {
    async getBlock() {
      return { baseFeePerGas: 40_000_000n, gasUsed: 30_000_000n, gasLimit: 60_000_000n };
    },
    async request({ method, params }: { method: string; params?: unknown }) {
      if (method === "eth_feeHistory") {
        assert.deepEqual(params, ["0xa", "latest", [50]]);
        if (history instanceof Error) throw history;
        return history;
      }
      assert.equal(method, "eth_maxPriorityFeePerGas");
      if (rpcTip instanceof Error) throw rpcTip;
      return rpcTip;
    },
  } as any;
}
const rewards = (tips: bigint[]) => ({ reward: tips.map(tip => [`0x${tip.toString(16)}`]) });

test("quiet Ethereum uses positive affordable tips with base-fee headroom", async () => {
  const result = await estimateFeeTiers(client(rewards(Array(10).fill(2n))), 1);
  assert.ok(result);
  assert.deepEqual(Object.values(result.tiers).map(t => t.maxPriorityFeePerGas),
    [100_000n, 112_000n, 125_440n]);
  for (const tier of Object.values(result.tiers)) {
    assert.ok(tier.maxFeePerGas >= result.predictedNextBaseFee + tier.maxPriorityFeePerGas);
  }
  assert.equal(formatGwei("112000"), "0.000112 Gwei");
});

test("Ethereum estimates follow observed demand above the old floor", async () => {
  const result = await estimateFeeTiers(client(rewards([
    100_000_000n, 200_000_000n, 300_000_000n, 400_000_000n,
    500_000_000n, 600_000_000n, 700_000_000n, 800_000_000n,
    900_000_000n, 1_000_000_000n,
  ])), 1);
  assert.deepEqual(Object.values(result!.tiers).map(t => t.maxPriorityFeePerGas),
    [300_000_000n, 700_000_000n, 1_000_000_000n]);
});

for (const history of [new Error("unsupported"), {}, rewards(Array(10).fill(0n)),
  { reward: [["oops"]] }, { reward: [[-1]] }, { reward: [["0x" + "f".repeat(65)]] },
  { reward: ["0x186a0"] }, rewards(Array(11).fill(1n))]) {
  test(`unusable history falls back to the configured RPC: ${JSON.stringify(history)}`, async () => {
    const result = await estimateFeeTiers(client(history), 1);
    assert.equal(result!.tiers.slow.maxPriorityFeePerGas, 100_000n);
  });
}
for (const tip of [new Error("unavailable"), "0x0", "invalid", "-1", 100000, null]) {
  test(`no usable fee evidence retains the conservative fallback: ${String(tip)}`, async () => {
    const result = await estimateFeeTiers(client(new Error("unsupported"), tip), 1);
    assert.equal(result!.tiers.slow.maxPriorityFeePerGas, 50_000_000n);
  });
}

test("other networks retain their existing floors", () => {
  for (const [chain, floor] of [[8453, 1_000_000n], [10, 1_000_000n],
    [42161, 1_000_000n], [137, 30_000_000_000n], [56, 1_000_000_000n],
    [130, 1_000_000n], [4326, 1_000_000n], [11155111, 100_000_000n]] as const) {
    assert.equal(getPriorityFeeFloor(chain), floor);
  }
});

test("a cheaper estimate cannot underprice an existing pending transaction", async () => {
  const estimate = await estimateFeeTiers(client(rewards(Array(10).fill(2n))), 1);
  const fees = recommendReplacementFees({
    maxFeePerGas: 100_000_000n, maxPriorityFeePerGas: 56_000_000n,
  } as any, {
    fastMaxFeePerGas: estimate!.tiers.fast.maxFeePerGas.toString(),
    fastMaxPriorityFeePerGas: estimate!.tiers.fast.maxPriorityFeePerGas.toString(),
    predictedNextBaseFee: estimate!.predictedNextBaseFee.toString(),
  });
  assert.equal(fees.maxPriorityFeePerGas, "63000000");
  assert.ok(BigInt(fees.maxFeePerGas) >= 130_000_000n);
});

test("an RPC fallback above the old floor is never capped downward", async () => {
  const result = await estimateFeeTiers(client(new Error("unsupported"), "0x77359400"), 1);
  assert.equal(result!.tiers.slow.maxPriorityFeePerGas, 2_000_000_000n);
});

test("low tips preserve full-block base-fee growth and preset headroom", async () => {
  const rpc = client(rewards(Array(10).fill(100_000n)));
  rpc.getBlock = async () => ({ baseFeePerGas: 40_000_000n,
    gasUsed: 60_000_000n, gasLimit: 60_000_000n });
  const result = await estimateFeeTiers(rpc, 1);
  assert.equal(result!.predictedNextBaseFee, 45_000_000n);
  assert.equal(result!.tiers.slow.maxFeePerGas, 56_350_000n);
  assert.equal(result!.tiers.standard.maxFeePerGas, 67_612_000n);
  assert.equal(result!.tiers.fast.maxFeePerGas, 90_125_440n);
});
