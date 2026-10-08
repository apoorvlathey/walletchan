import assert from "node:assert/strict";
import test from "node:test";
import { resolveSafeExecutionTime } from "../../src/chrome/safe/executionTime";

test("execution time uses the inclusion block, independently of proposal time", async () => {
  let requested: unknown;
  const client = { getBlock: async (input: unknown) => {
    requested = input;
    return { timestamp: 1_790_000_000n };
  } } as any;
  assert.equal(await resolveSafeExecutionTime({ chainId: 8453, blockNumber: "0x10", client, fallback: 100 }),
    1_790_000_000_000);
  assert.deepEqual(requested, { blockNumber: 16n });
});

test("missing or unavailable block data cannot block receipt settlement", async () => {
  const failing = { getBlock: async () => { throw new Error("offline"); } } as any;
  assert.equal(await resolveSafeExecutionTime({ chainId: 8453, blockNumber: 16n, client: failing, fallback: 100 }), 100);
  assert.equal(await resolveSafeExecutionTime({ chainId: 8453, blockNumber: undefined, client: failing, fallback: 100 }), 100);
  const invalid = { getBlock: async () => ({ timestamp: 0n }) } as any;
  assert.equal(await resolveSafeExecutionTime({ chainId: 8453, blockNumber: 16n, client: invalid, fallback: 100 }), 100);
});
