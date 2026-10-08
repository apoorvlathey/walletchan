import { createRootSnapshotCache } from "@walletchan/shared/privacy/rootSnapshotCache";
import { computePrivacyAspTreeRootsOffscreen } from "../prover/coordinator";
import { fetchPrivacyAspLeaves, fetchPrivacyAspRoots } from "./client";
import { readPrivacyAspOnchainRoots } from "./onchain";
import { rememberPrivacyAspTreeEvidence } from "./treeEvidence";
import type { PrivacyAspLeaves, PrivacyAspRoots } from "./types";

export function createPrivacyAspSnapshotLoader(dependencies: {
  readRoots: () => Promise<PrivacyAspRoots>;
  readLeaves: () => Promise<PrivacyAspLeaves>;
  computeRoots: (leaves: PrivacyAspLeaves) => Promise<{ mtRoot: string; onchainMtRoot: string }>;
  readOnchain: typeof readPrivacyAspOnchainRoots;
}) {
  const cache = createRootSnapshotCache({
    readRoots: dependencies.readRoots,
    load: async (roots) => {
      const leaves = await dependencies.readLeaves();
      const computed = await dependencies.computeRoots(leaves);
      if (computed.mtRoot !== roots.mtRoot || computed.onchainMtRoot !== roots.onchainMtRoot) {
        throw new Error("ASP membership roots do not match");
      }
      rememberPrivacyAspTreeEvidence(leaves, computed);
      return leaves;
    },
  });
  return {
    async get() {
      const { roots, data: leaves } = await cache.get();
      // Never cache chain authority: association roots are latest-only and the
      // state root can age out of the pool's 64-slot history.
      const onchain = await dependencies.readOnchain({ expectedStateRoot: BigInt(roots.onchainMtRoot) });
      if (BigInt(roots.mtRoot) !== onchain.associationRoot || BigInt(roots.onchainMtRoot) !== onchain.verifiedStateRoot) {
        throw new Error("ASP roots do not match the active Privacy Pools deployment");
      }
      return { roots, leaves, onchain };
    },
    clear: cache.clear,
  };
}

// Module lifetime only: one deployment, one public snapshot, no storage migration
// or wallet identity in the cache. MV3 restart simply verifies a new snapshot.
const snapshotLoader = createPrivacyAspSnapshotLoader({
  readRoots: fetchPrivacyAspRoots,
  readLeaves: fetchPrivacyAspLeaves,
  computeRoots: computePrivacyAspTreeRootsOffscreen,
  readOnchain: readPrivacyAspOnchainRoots,
});
export const getPrivacyAspSnapshot = snapshotLoader.get;
