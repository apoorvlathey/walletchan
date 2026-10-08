import { createPublicClient, getAddress } from "viem";
import { getAccountById } from "../accountStorage";
import { getStoredRpcUrl } from "@/lib/chains";
import { secureHttpTransport } from "../network/rpcClient";
import { getSafeProposal } from "./proposalRepository";
import { verifySafeOnchainState } from "./onchainState";
import { canSafeOwnerSignAndExecute } from "./signAndExecutePolicy";
import { buildSafeFinalOwnerPreviewData } from "./executionData";
import { approveSafeProposalWithOwner } from "./ownerAuthorization";
import { authorizeSafeProposalRoute } from "./proposalLifecycle";
import { estimateSafeExecution, executeSafeProposal } from "./execution";
import { validateSafeGasOverrides } from "./executionGas";
import type { GasOverrides } from "../transactions/localExecution";

const production = {
  getSafeProposal, getAccountById, verifySafeOnchainState,
  approveSafeProposalWithOwner, authorizeSafeProposalRoute,
  estimateSafeExecution, executeSafeProposal,
};
type Dependencies = typeof production;

async function finalOwnerContext(input: { proposalId: string; ownerAccountId: string }, deps: Dependencies) {
  const [proposal, account] = await Promise.all([
    deps.getSafeProposal(input.proposalId), deps.getAccountById(input.ownerAccountId),
  ]);
  if (!proposal) throw new Error("Safe proposal not found");
  const live = await deps.verifySafeOnchainState({ chainId: proposal.chainId, safeAddress: proposal.safeAddress });
  if (!canSafeOwnerSignAndExecute(proposal, live, account)) {
    throw new Error("Sign & Execute requires the last unsigned owner and the current Safe nonce");
  }
  return { proposal, account };
}

/** Read-only preparation, with headroom for ECDSA recovery and calldata costs. */
export async function prepareSafeSignAndExecute(input: { proposalId: string; ownerAccountId: string }) {
  const { proposal, account } = await finalOwnerContext(input, production);
  const rpcUrl = await getStoredRpcUrl(proposal.chainId);
  if (!rpcUrl) throw new Error("No RPC configured for network");
  const client = createPublicClient({ transport: secureHttpTransport(rpcUrl, { timeout: 15_000, retryCount: 1 }) });
  const data = buildSafeFinalOwnerPreviewData(proposal, account.address);
  const gas = await client.estimateGas({ account: getAddress(account.address), to: getAddress(proposal.safeAddress), data, value: 0n });
  return { data, gas: ((gas * 120n) / 100n + 20_000n).toString() };
}

/** Reuses both existing guarded effects; a failed execution leaves approval saved. */
export async function signAndExecuteSafeProposal(input: {
  proposalId: string;
  ownerAccountId: string;
  gasOverrides: GasOverrides;
  allowSimulationFailure?: unknown;
}, overrides: Partial<Dependencies> = {}) {
  const deps = { ...production, ...overrides };
  const gas = validateSafeGasOverrides(input.gasOverrides);
  if (!gas) throw new Error("Review the execution fee before signing");
  await finalOwnerContext(input, deps);
  const approved = await deps.approveSafeProposalWithOwner(input);
  await deps.authorizeSafeProposalRoute(approved);
  try {
    const estimate = await deps.estimateSafeExecution({ proposalId: input.proposalId, executorAccountId: input.ownerAccountId });
    if (BigInt(estimate.gas) > BigInt(gas.gas)) {
      throw new Error("Execution gas exceeds the reviewed limit; review the fee again");
    }
    return await deps.executeSafeProposal({
      proposalId: input.proposalId, executorAccountId: input.ownerAccountId,
      gasOverrides: input.gasOverrides, allowSimulationFailure: input.allowSimulationFailure,
      feePaymentToken: "native",
    });
  } catch (error) {
    throw new Error(`Approval saved. ${error instanceof Error ? error.message : "Execution failed"}`);
  }
}
