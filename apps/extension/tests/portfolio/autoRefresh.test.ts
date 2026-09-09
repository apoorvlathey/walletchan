import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("portfolio timer refreshes at 60 seconds, uses the latest loader, skips busy work and cleans up", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const effects: Array<() => (() => void) | undefined> = [];
  const ref = { current: undefined as any };
  const module = { exports: {} as any };
  const source = readFileSync(new URL("../../src/components/Portfolio/Holdings/useHoldingsLifecycle.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: module.exports,
    module,
    require: (name: string) => name === "react" ? {
      useRef: () => ref,
      useEffect: (effect: () => (() => void) | undefined) => effects.push(effect),
    } : {},
    window: { setInterval, clearInterval },
  });
  const calls: unknown[][] = [];
  const state = { loading: false, portfolioBalanceRefreshing: false };
  const render = (loader: (...args: unknown[]) => Promise<void>, address = "0x123") => {
    effects.length = 0;
    module.exports.useHoldingsLifecycle({ address, chainReloadKey: "1", loadPortfolio: loader, state });
  };
  render(async (...args) => { calls.push(args); });
  const stop = effects[0]()!;
  t.mock.timers.tick(59_999);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], true);
  assert.equal((calls[0][1] as any).suppressSkeleton, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.portfolioBalanceRefreshing = true;
  t.mock.timers.tick(60_000);
  assert.equal(calls.length, 1);
  state.portfolioBalanceRefreshing = false;
  let latestCalls = 0;
  render(async () => { latestCalls++; });
  t.mock.timers.tick(60_000);
  assert.equal(latestCalls, 1);
  stop();
  await new Promise<void>((resolve) => setImmediate(resolve));
  t.mock.timers.tick(60_000);
  assert.equal(latestCalls, 1);
  render(async () => {}, "");
  assert.equal(effects[0](), undefined);
});
