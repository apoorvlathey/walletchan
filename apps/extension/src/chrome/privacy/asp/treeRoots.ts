import { poseidon2 } from "poseidon-lite/poseidon2";
import type { PrivacyAspLeaves } from "./types";

/** LeanIMT promotes an unpaired node unchanged; never duplicate or hash zero. */
export function privacyAspTreeRoot(leaves: readonly string[]): string {
  if (leaves.length === 0) throw new Error("Empty ASP tree");
  let level = leaves.map(BigInt);
  while (level.length > 1) {
    const next: bigint[] = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(index + 1 < level.length
        ? poseidon2([level[index], level[index + 1]])
        : level[index]);
    }
    level = next;
  }
  return level[0].toString();
}

export function computePrivacyAspTreeRoots(leaves: PrivacyAspLeaves) {
  return {
    mtRoot: privacyAspTreeRoot(leaves.aspLeaves),
    onchainMtRoot: privacyAspTreeRoot(leaves.stateTreeLeaves),
  };
}
