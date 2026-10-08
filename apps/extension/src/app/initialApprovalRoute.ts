import type { SafeProposalRecord } from "@/chrome/safe/types";
import type { PendingBatchTxRequest } from "@/chrome/erc5792Types";
import type { PendingErc7715PermissionRequest } from "@/chrome/pendingErc7715PermissionStorage";
import type { PendingSignatureRequest } from "@/chrome/requests/pendingSignatureStorage";
import type { PendingTxRequest } from "@/chrome/requests/pendingTxStorage";
import type { PendingDappConnectionRequest } from "@/chrome/requests/dappPermissionStorage";
import type { ProviderRequestSurfaceHint } from "@/chrome/windowing/providerRequestSurface";

export type InitialApprovalRequestLists = readonly [
  readonly PendingTxRequest[],
  readonly PendingSignatureRequest[],
  readonly PendingErc7715PermissionRequest[],
  readonly PendingBatchTxRequest[],
  readonly PendingDappConnectionRequest[],
  (readonly SafeProposalRecord[])?,
];

export type InitialApprovalRoute =
  | { kind: "safe"; request: SafeProposalRecord }
  | { kind: "transaction"; request: PendingTxRequest }
  | { kind: "signature"; request: PendingSignatureRequest }
  | { kind: "permission"; request: PendingErc7715PermissionRequest }
  | { kind: "batch"; request: PendingBatchTxRequest }
  | { kind: "dappConnection"; request: PendingDappConnectionRequest };

type InitialApprovalView =
  | "txConfirm"
  | "signatureConfirm"
  | "erc7715PermissionConfirm"
  | "batchTxConfirm"
  | "dappConnectionConfirm";

interface InitialApprovalRouteSetters {
  setSafe: (request: SafeProposalRecord) => void;
  setTransaction: (request: PendingTxRequest) => void;
  setSignature: (request: PendingSignatureRequest) => void;
  setPermission: (request: PendingErc7715PermissionRequest) => void;
  setBatch: (request: PendingBatchTxRequest) => void;
  setDappConnection: (request: PendingDappConnectionRequest) => void;
  setView: (view: InitialApprovalView) => void;
}

function newest<T>(requests: readonly T[]): T | null {
  return requests.length > 0 ? requests[requests.length - 1] : null;
}

/** Resolves only the queue named by the sidepanel-opening hint. */
export function resolveHintedInitialApprovalRoute(
  hint: ProviderRequestSurfaceHint | null,
  [
    transactions,
    signatures,
    permissions,
    batches,
    dappConnections,
    safeProposals = [],
  ]: InitialApprovalRequestLists,
): InitialApprovalRoute | null {
  if (!hint) return null;

  if (hint.requestType === "i_sendTransaction" || hint.requestType === "i_walletSendCalls") {
    const request = [...safeProposals].reverse().find((proposal) =>
      proposal.createdAt >= hint.createdAt &&
      (hint.requestType === "i_walletSendCalls" ? proposal.route.kind === "erc5792" :
        proposal.route.kind === "injected" || proposal.route.kind === "walletConnect"));
    if (request) return { kind: "safe", request };
  }
  switch (hint.requestType) {
    case "i_sendTransaction": {
      const request = newest(transactions);
      return request ? { kind: "transaction", request } : null;
    }
    case "i_signatureRequest": {
      const request = newest(signatures);
      return request ? { kind: "signature", request } : null;
    }
    case "i_walletExecutionPermissions": {
      const request = newest(permissions);
      return request ? { kind: "permission", request } : null;
    }
    case "i_walletSendCalls": {
      const request = newest(batches);
      return request ? { kind: "batch", request } : null;
    }
    case "i_dappAccounts": {
      const request = newest(dappConnections);
      return request ? { kind: "dappConnection", request } : null;
    }
  }
}

export function applyInitialApprovalRoute(
  route: InitialApprovalRoute,
  setters: InitialApprovalRouteSetters,
): void {
  switch (route.kind) {
    case "safe":
      setters.setSafe(route.request);
      return;
    case "transaction":
      setters.setTransaction(route.request);
      setters.setView("txConfirm");
      return;
    case "signature":
      setters.setSignature(route.request);
      setters.setView("signatureConfirm");
      return;
    case "permission":
      setters.setPermission(route.request);
      setters.setView("erc7715PermissionConfirm");
      return;
    case "batch":
      setters.setBatch(route.request);
      setters.setView("batchTxConfirm");
      return;
    case "dappConnection":
      setters.setDappConnection(route.request);
      setters.setView("dappConnectionConfirm");
  }
}
