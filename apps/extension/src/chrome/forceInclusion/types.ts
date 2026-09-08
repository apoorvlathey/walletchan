import type { DirectSigningAccountType } from "../accounts/accountTypePolicy";

export type ForceInclusionStage =
  | "building"
  | "submitting"
  | "waiting-l1"
  | "complete"
  | "error";

export interface ForceInclusionProgressData {
  stage: ForceInclusionStage;
  l1Hash?: string;
  l2Hash?: string;
  error?: string;
  l1ChainId: number;
  l2ChainId: number;
  timestamp: number;
}

export type ForceInclusionProgressWriter = (
  stage: ForceInclusionStage,
  extra?: Partial<ForceInclusionProgressData>,
) => Promise<void>;

export interface ForceInclusionAccount {
  id: string;
  address: string;
  type: DirectSigningAccountType;
}

export interface ForceInclusionGasOverrides {
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

/** Hardware confirmations retain the pending request until the final L1 approval. */
export interface ForceInclusionLifecycle {
  beforeBroadcast: () => Promise<void>;
  submitted: () => void;
  failed: (error: string) => void;
}
