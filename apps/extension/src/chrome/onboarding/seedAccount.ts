/** Background-only generation for the short fresh-wallet onboarding path. */
import { addSeedPhraseGroup } from "../mnemonic/accountHandlers";
import { generateNewMnemonic } from "../mnemonic/derivation";
import { isOnboardingInitializationOwner } from "./state";

export async function createOnboardingSeedAccount(initializationId: string) {
  if (!(await isOnboardingInitializationOwner(initializationId))) {
    return { success: false as const, error: "Wallet setup session is no longer valid" };
  }
  // No plaintext phrase leaves this call stack. Persistence rechecks owner and
  // live master authority under the wallet operation lock and marks the group.
  const result = await addSeedPhraseGroup(
    { mnemonic: generateNewMnemonic(), indices: [0] }, initializationId,
  );
  if (!result.success) return result;
  return { success: true as const, account: result.account };
}
