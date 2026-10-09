import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { formatUnits } from "viem";
import { getSwapSubmissionKind } from "../../src/components/Swap/swapSubmissionModel";

// Exercise the real preparation and review hooks; only React scheduling and
// external quote/submission boundaries are replaced with deterministic doubles.
function harness(accountType = "privateKey", isBridge = false) {
  const slots: any[] = [];
  let cursor = 0;
  let dirty = false;
  let executions = 0;
  let proposals = 0;
  let preparations = 0;
  let failRefresh = false;
  let buyAmount = "80";
  let sellAmount = "100";
  const react = {
    useRef(value: unknown) {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useState(value: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], (next: any) => {
        slots[index] = typeof next === "function" ? next(slots[index]) : next;
        dirty = true;
      }];
    },
  };
  const prepare = async () => {
    preparations++;
    if (failRefresh) throw new Error("Quote unavailable");
    return {
      transactions: [{ tx: { to: "0x1", data: "0x", value: "0", chainId: 1 } }],
      quote: { buyAmount, sellAmount }, batchTx: null, delegation: null,
    };
  };
  const mocks: Record<string, unknown> = {
    react, viem: { formatUnits },
    "@/hooks/useThemedToast": { useThemedToast: () => () => {} },
    "./swapSubmissionModel": { getSwapSubmissionKind },
    "./prepareSameChainSwap": { prepareSameChainSwap: prepare },
    "./prepareBridgeSwap": { prepareBridgeSwap: prepare },
    "./executePreparedSwap": { executePreparedSwap: async () => { executions++; return true; } },
    "./safeSwapProposal": { createSafeSwapProposal: async () => { proposals++; return "proposal"; } },
  };
  function load(name: string) {
    const exports = {};
    const source = readFileSync(new URL(`../../src/components/Swap/${name}.ts`, import.meta.url), "utf8");
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports, crypto: { randomUUID },
      require: (name: string) => {
        assert.ok(name in mocks, `Unexpected dependency: ${name}`);
        return mocks[name];
      },
    });
    return exports as any;
  }
  mocks["./useSwapPriceImpactDecision"] = load("useSwapPriceImpactDecision");
  const { usePreparedSwap } = load("usePreparedSwap");
  const options = {
    sellToken: { contractAddress: "native", decimals: 0, priceUsd: 1 },
    buyTokenInfo: { decimals: 0 }, buyTokenPriceUsd: 1,
    buyTokenAddress: "0x2", sellTokenAmount: "100",
    quote: { buyAmount: "98", sellAmount: "100" },
    accountId: "account", accountType, fromAddress: "0x3",
    sellChainId: 1, buyChainId: isBridge ? 8453 : 1, isBridge,
    chainName: "Ethereum", resolvedBuyChainName: "Base", slippageBps: 50,
    onSwapInitiated() {}, onSafeProposalCreated() {},
  };
  const render = () => {
    let result: any;
    do {
      cursor = 0; dirty = false;
      result = usePreparedSwap(options);
    } while (dirty);
    return result;
  };
  return {
    render, options,
    quote(buy: string, sell = "100") { buyAmount = buy; sellAmount = sell; },
    failRefresh() { failRefresh = true; },
    counts: () => ({ executions, proposals, preparations }),
  };
}

for (const account of ["privateKey", "seedPhrase", "bankr", "safe"]) {
  test(`${account}: firm quote loss blocks submission until explicitly acknowledged`, async () => {
    const h = harness(account);
    await h.render().stagePlan();
    let review = h.render();
    assert.equal(review.showConfirmation, true);
    assert.equal(review.impactReview.outputUsd, 80);
    assert.equal(review.impactReview.priceImpact, 20);
    assert.equal(h.counts().proposals, 0, "preparation must not create a Safe proposal");
    await review.confirm("native", null);
    assert.equal(h.counts().executions + h.counts().proposals, 0);
    review.impactReview.decision.setAcknowledged(true);
    review = h.render();
    await review.confirm("native", null);
    assert.equal(h.counts().executions, account === "safe" ? 0 : 1);
    assert.equal(h.counts().proposals, account === "safe" ? 1 : 0);
    await review.confirm("native", null);
    assert.equal(h.counts().executions + h.counts().proposals, 1, "consumed review cannot submit twice");
  });
}

test("bridge refresh resets acknowledgement even for identical amounts and rejects stale callbacks", async () => {
  const h = harness("seedPhrase", true);
  await h.render().stagePlan();
  h.render().impactReview.decision.setAcknowledged(true);
  const old = h.render();
  await old.stagePlan();
  let next = h.render();
  assert.notEqual(next.preparedRequestId, old.preparedRequestId);
  assert.equal(next.impactReview.decision.blocked, true);
  await next.confirm("native", null);
  next.impactReview.decision.setAcknowledged(true);
  next = h.render();
  await old.confirm("native", null);
  assert.equal(h.counts().executions, 0);
  await next.confirm("native", null);
  assert.equal(h.counts().executions, 1);
});

test("failed refresh invalidates the previously acknowledged quote", async () => {
  const h = harness();
  await h.render().stagePlan();
  h.render().impactReview.decision.setAcknowledged(true);
  const old = h.render();
  h.failRefresh();
  await old.stagePlan();
  assert.equal(h.render().showConfirmation, false);
  await old.confirm("native", null);
  assert.equal(h.counts().executions, 0);
});

test("review uses the firm sell amount after balance clamping; low impact needs no checkbox", async () => {
  const h = harness();
  h.quote("79", "80");
  await h.render().stagePlan();
  const review = h.render();
  assert.equal(review.preparedSellAmount, "80");
  assert.equal(review.preparedSellUsd, 80);
  assert.equal(review.impactReview.priceImpact, 1.25);
  assert.equal(review.impactReview.decision.blocked, false);
  await review.confirm("native", null);
  assert.equal(h.counts().executions, 1);
});

test("price changes and cancellation invalidate approval", async () => {
  const h = harness();
  await h.render().stagePlan();
  h.render().impactReview.decision.setAcknowledged(true);
  const old = h.render();
  h.options.buyTokenPriceUsd = 0.5;
  const changed = h.render();
  assert.equal(changed.impactReview.decision.blocked, true);
  await old.confirm("native", null);
  changed.impactReview.decision.setAcknowledged(true);
  const acknowledged = h.render();
  acknowledged.cancel();
  await acknowledged.confirm("native", null);
  assert.equal(h.counts().executions, 0);
});

for (const [account, bridge] of [["ledger", false], ["impersonator", false], ["safe", true]] as const) {
  test(`${account} bridge=${bridge}: unsupported paths never prepare or submit`, async () => {
    const h = harness(account, bridge);
    await h.render().stagePlan();
    await h.render().confirm("native", null);
    assert.deepEqual(h.counts(), { executions: 0, proposals: 0, preparations: 0 });
  });
}
