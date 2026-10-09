import type { PreviewEnvironment } from "./previewEnvironment";
import { PREVIEW_EPOCH_MS } from "./fixtures";

export function previewSeedGroups(environment: PreviewEnvironment) {
  const pending = environment.parsed.state.scenario === "backup-pending" && !environment.storage.local.previewSeedBackupConfirmed;
  return environment.seedGroups.map((group) => pending ? { ...group, backupPending: true as const } : group);
}
export function previewCreateSeedAccount(environment: PreviewEnvironment) {
  const account = { id: "preview-created-seed", type: "seedPhrase" as const,
    address: "0x0000000000000000000000000000000000000001" as const,
    seedGroupId: "preview-created-group", derivationIndex: 0, createdAt: PREVIEW_EPOCH_MS };
  environment.accounts = [account];
  environment.seedGroups = [{ id: account.seedGroupId, name: "Seed #1", createdAt: PREVIEW_EPOCH_MS, accountCount: 1, backupPending: true }];
  return { success: true, account };
}
export function previewConfirmSeedBackup(environment: PreviewEnvironment, message: { seedGroupId?: string; confirmed?: boolean }) {
  if (message.confirmed !== true || !environment.seedGroups.some((group) => group.id === message.seedGroupId)) return { success: false, error: "Backup confirmation is required" };
  environment.seedGroups = environment.seedGroups.map((group) => group.id === message.seedGroupId ? { ...group, backupPending: undefined } : group);
  environment.storage.local.previewSeedBackupConfirmed = true;
  return { success: true };
}
