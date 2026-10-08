import type { PrivacyAspLeaves, PrivacyAspRoots } from "./types";

type TreeEvidence = {
  roots: Pick<PrivacyAspRoots, "mtRoot" | "onchainMtRoot">;
  labels: Set<string>;
  commitments: Set<string>;
};
const evidence = new WeakMap<PrivacyAspLeaves, TreeEvidence>();

/** Only the internal snapshot loader calls this after trusted worker root computation. */
export function rememberPrivacyAspTreeEvidence(
  leaves: PrivacyAspLeaves,
  roots: Pick<PrivacyAspRoots, "mtRoot" | "onchainMtRoot">,
): void {
  Object.freeze(leaves.aspLeaves);
  Object.freeze(leaves.stateTreeLeaves);
  Object.freeze(leaves);
  evidence.set(leaves, {
    roots: Object.freeze({ ...roots }),
    labels: new Set(leaves.aspLeaves),
    commitments: new Set(leaves.stateTreeLeaves),
  });
}

/** Identity-bound frozen leaves are safe to reuse; roots alone cannot populate this cache. */
export function hasVerifiedPrivacyAspMembership(input: {
  leaves: PrivacyAspLeaves;
  roots: PrivacyAspRoots;
  label: string;
  commitment: string;
}): boolean | null {
  const trees = evidence.get(input.leaves);
  if (!trees) return null;
  if (trees.roots.mtRoot !== input.roots.mtRoot || trees.roots.onchainMtRoot !== input.roots.onchainMtRoot) {
    throw new Error("ASP membership roots do not match");
  }
  return trees.labels.has(input.label) && trees.commitments.has(input.commitment);
}
