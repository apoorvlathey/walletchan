import { PRIVACY_ASP_LEAVES_RESPONSE_BYTES } from "@walletchan/shared/privacy/aspPolicy";
import { createRootSnapshotCache } from "@walletchan/shared/privacy/rootSnapshotCache";
import { DEPLOYMENTS, fetchBoundedJson, parseAspLeaves, parseAspRoots } from "./verification";
import type { PrivacyPoolsExplorerNetwork } from "../../privacy-pools-explorer/types";

function createSnapshot(network: PrivacyPoolsExplorerNetwork) {
  const deployment = DEPLOYMENTS[network];
  const headers = { Accept: "application/json", "X-Pool-Scope": deployment.scope };
  return createRootSnapshotCache({
    readRoots: async () => parseAspRoots(await fetchBoundedJson(`${deployment.aspBaseUrl}/${deployment.chainId}/public/mt-roots`, headers)),
    load: async () => {
      const leaves = parseAspLeaves(await fetchBoundedJson(`${deployment.aspBaseUrl}/${deployment.chainId}/public/mt-leaves`, headers, PRIVACY_ASP_LEAVES_RESPONSE_BYTES));
      return new Set(leaves.aspLeaves);
    },
  });
}
const snapshots = { mainnet: createSnapshot("mainnet"), sepolia: createSnapshot("sepolia") };
// This cache is advisory explorer data, never an extension signing authority.
// latestRoot() is still read for every transaction verification.
export function getPrivacyExplorerSnapshot(network: PrivacyPoolsExplorerNetwork) {
  return snapshots[network].get();
}
