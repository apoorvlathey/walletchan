import assert from "node:assert/strict";
import test from "node:test";
import { FORCE_INCLUSION_CHAINS, VIEM_CHAINS, isForceInclusionSupported, isForceInclusionSupportedForAccount } from "../../src/constants/chainRegistry";
import { resolveLocalBatchForceInclusion } from "../../src/chrome/batch/batchForceInclusionPolicy";

// Independent deployment pins from Robinhood's published node configurations.
const deployments = [
  { chainId: 4663, parent: 1, name: "Ethereum",
    inbox: "0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D",
    bridge: "0xDf8755334ce7A73cCF6b581C02eA649AE3E864b3",
    sequencerInbox: "0xBd0D173EEb87D57A09521c24388a12789F33ba96" },
  { chainId: 46630, parent: 11155111, name: "Sepolia",
    inbox: "0xF2939afA86F6f933A3CE17fCAB007907B6b0B7a4",
    bridge: "0x96295BDad104eaD97cC08797b3dC68efF59CcF30",
    sequencerInbox: "0xA0D9dB3DC9791D54b5183C1C1866eFe1eCA7D414" },
] as const;

for (const deployment of deployments) {
  test(`Robinhood ${deployment.chainId} routes to its own parent deployment`, () => {
    const route = FORCE_INCLUSION_CHAINS.get(deployment.chainId);
    assert.ok(route);
    assert.equal(isForceInclusionSupported(deployment.chainId), true);
    assert.equal(route.protocol, "arbitrum");
    assert.equal(route.viemChain, VIEM_CHAINS[deployment.chainId]);
    assert.equal(route.viemChain.id, deployment.chainId);
    assert.equal(route.l1ChainId, deployment.parent);
    assert.equal(route.l1ChainName, deployment.name);
    assert.deepEqual(route.arbitrumContracts, {
      inbox: deployment.inbox, bridge: deployment.bridge, sequencerInbox: deployment.sequencerInbox,
    });
  });
  test(`Robinhood ${deployment.chainId} preserves all account capability boundaries`, () => {
    for (const type of ["privateKey", "seedPhrase"] as const) {
      assert.equal(isForceInclusionSupportedForAccount(deployment.chainId, type), true, type);
    }
    for (const type of ["bankr", "ledger", "safe", "impersonator", undefined] as const) {
      assert.equal(isForceInclusionSupportedForAccount(deployment.chainId, type), false, type);
    }
  });
  test(`Robinhood ${deployment.chainId} cannot use the OP Stack batch deposit path`, async () => {
    assert.equal((await resolveLocalBatchForceInclusion(deployment.chainId, true)).ok, false);
    assert.deepEqual(await resolveLocalBatchForceInclusion(deployment.chainId, false), { ok: true, processor: null });
  });
}
test("adding Robinhood preserves existing routes and excludes unknown chains", () => {
  assert.equal(FORCE_INCLUSION_CHAINS.get(42161)?.protocol, "arbitrum");
  assert.equal(FORCE_INCLUSION_CHAINS.get(8453)?.protocol, "op-stack");
  assert.equal(isForceInclusionSupportedForAccount(8453, "bankr"), true);
  assert.equal(isForceInclusionSupported(46631), false);
  assert.equal(isForceInclusionSupportedForAccount(46631, "privateKey"), false);
});
