/** Master-only acknowledgment of the non-secret recovery reminder. */
import { confirmSeedGroupBackup } from "../accountStorage";
import { resolveMasterMnemonicAccess } from "./masterAccess";
import { assertCurrentMasterAuthorization } from "../masterAuthorization";
import { WALLET_SECRET_OPERATION_LOCK_KEY, withStorageLock } from "../storageLock";

export async function confirmSeedBackup(seedGroupId: string) {
  try {
    const access = await resolveMasterMnemonicAccess();
    if (!access.success) return access;
    await withStorageLock(WALLET_SECRET_OPERATION_LOCK_KEY, async () => {
      assertCurrentMasterAuthorization(access.authEpoch);
      await confirmSeedGroupBackup(seedGroupId, access.authEpoch);
    });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Could not save backup confirmation" };
  }
}
