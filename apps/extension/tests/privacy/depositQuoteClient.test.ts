import assert from "node:assert/strict";
import test from "node:test";
import { BaseError, InsufficientFundsError, type PublicClient } from "viem";

import { readPrivacyShieldRpcQuote } from "../../src/chrome/privacy/deposit/quoteClient";
import { PrivacyShieldQuoteError } from "../../src/chrome/privacy/deposit/quotePolicy";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const AMOUNT = 10_050_251_256_281_407n;

function client(balance: bigint, estimate: () => Promise<bigint>): PublicClient {
  return {
    getBalance: async ({ address }: { address: string }) => {
      assert.equal(address, ADDRESS);
      return balance;
    },
    estimateGas: async (request: { account: string; value: bigint }) => {
      assert.equal(request.account, ADDRESS);
      assert.equal(request.value, AMOUNT);
      return estimate();
    },
  } as unknown as PublicClient;
}

const fees = async () => ({
  maxFeePerGas: 2_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  baseFee: 1_000_000_000n,
});

const isInsufficient = (error: unknown) =>
  error instanceof PrivacyShieldQuoteError && error.code === "insufficient-funds";

test("default and oversized Shield amounts reject insufficient balance before gas RPC", async () => {
  for (const balance of [1_000_000_000_000_000n, 9_000_000_000_000_000n, AMOUNT - 1n]) {
    let gasCalls = 0;
    let feeCalls = 0;
    await assert.rejects(readPrivacyShieldRpcQuote("https://rpc.example", ADDRESS, AMOUNT, {
      createClient: () => client(balance, async () => { gasCalls++; return 100_000n; }),
      estimateFees: async () => { feeCalls++; return fees(); },
    }), isInsufficient);
    assert.equal(gasCalls, 0);
    assert.equal(feeCalls, 0);
  }
});

test("RPC insufficient-gas errors retain the actionable balance code", async () => {
  await assert.rejects(readPrivacyShieldRpcQuote("https://rpc.example", ADDRESS, AMOUNT, {
    createClient: () => client(AMOUNT, async () => {
      throw new BaseError("estimate failed", { cause: new InsufficientFundsError() });
    }),
    estimateFees: fees,
  }), isInsufficient);
});

test("funded Shield quotes keep the exact deposit estimate and buffer", async () => {
  const balance = AMOUNT * 10n;
  assert.deepEqual(await readPrivacyShieldRpcQuote("https://rpc.example", ADDRESS, AMOUNT, {
    createClient: () => client(balance, async () => 100_000n),
    estimateFees: fees,
  }), { balanceWei: balance, gasLimit: 120_000n, maxFeePerGas: 2_000_000_000n });
});

test("unrelated RPC failures are not mislabeled as insufficient balance", async () => {
  const failure = new BaseError("RPC unavailable");
  await assert.rejects(readPrivacyShieldRpcQuote("https://rpc.example", ADDRESS, AMOUNT, {
    createClient: () => client(AMOUNT * 10n, async () => { throw failure; }),
    estimateFees: fees,
  }), (error: unknown) => error === failure);
});


test("a balance below the profile minimum has a distinct failure code", async () => {
  for (const balance of [0n, 999_999_999_999_999n]) {
    await assert.rejects(readPrivacyShieldRpcQuote("https://rpc.example", ADDRESS, AMOUNT, {
      createClient: () => client(balance, async () => { throw new Error("must not estimate"); }),
      estimateFees: fees,
    }), (error: unknown) => error instanceof PrivacyShieldQuoteError && error.code === "balance-below-minimum");
  }
});
