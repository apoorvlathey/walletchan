import { keccak256, type Hex, type LocalAccount } from "viem";
import { privateKeyToAccount, toAccount } from "viem/accounts";
import type { RawForceInclusionAccount, RawForceInclusionAccountType } from "../accounts/accountTypePolicy";
import { getAccountById } from "../accountStorage";
import { getLocalPrivateKeyForAccount } from "../accounts/localKeyResolver";
import { getAuthCeremonyEpoch, isCurrentAuthCeremonyEpoch } from "../authTransition";
import { getPasswordType } from "../sessionCache";
import { signPreparedLedgerTransaction } from "../ledger/signing";
import { ensureLedgerSigningSession } from "../ledger/session";
import { broadcastSerializedTransaction, prepareSignAndBroadcastTransaction } from "../localSigner";
import { WALLET_SECRET_OPERATION_LOCK_KEY, withStorageLock } from "../storageLock";

export interface RawForceInclusionSigner {
  account: LocalAccount;
  signChild: (request: Parameters<LocalAccount["signTransaction"]>[0]) => Promise<Hex>;
  broadcast: typeof prepareSignAndBroadcastTransaction;
  assertAvailable: () => Promise<void>;
}

/** Existing local confirmation already resolved and authorized this key. */
export function localForceInclusionSigner(key: Hex): RawForceInclusionSigner {
  const account = privateKeyToAccount(key);
  return {
    account,
    signChild: (request) => withStorageLock(WALLET_SECRET_OPERATION_LOCK_KEY, () => account.signTransaction(request)),
    broadcast: prepareSignAndBroadcastTransaction,
    assertAvailable: async () => {},
  };
}

type FactoryInput<Type extends RawForceInclusionAccountType> = {
  account: Extract<RawForceInclusionAccount, { type: Type }>;
  opId: string;
  signal?: AbortSignal;
};
type SignerFactories = {
  [Type in RawForceInclusionAccountType]: (input: FactoryInput<Type>) => Promise<RawForceInclusionSigner>;
};

async function localFactory(input: { account: Extract<RawForceInclusionAccount, { type: "privateKey" | "seedPhrase" }>; opId: string; signal?: AbortSignal }) {
  const key = await getLocalPrivateKeyForAccount(input.account.id, "");
  if (!key) throw new Error("Unlock wallet to force inclusion");
  const signer = localForceInclusionSigner(key);
  const assertAvailable = bindAuthority(input.account, input.signal);
  return { ...signer, assertAvailable };
}

/** New raw-capable account types MUST implement this table, not just the UI gate. */
export const RAW_FORCE_INCLUSION_SIGNERS = {
  privateKey: localFactory,
  seedPhrase: localFactory,
  ledger: async (input: FactoryInput<"ledger">): Promise<RawForceInclusionSigner> => {
    await ensureLedgerSigningSession("");
    const assertAvailable = bindAuthority(input.account, input.signal);
    const account = toAccount({
      address: input.account.address as Hex,
      signMessage: async () => { throw new Error("Transaction-only signing capability"); },
      signTypedData: async () => { throw new Error("Transaction-only signing capability"); },
      signTransaction: async (transaction) => {
        await assertAvailable();
        const signed = await signPreparedLedgerTransaction({
          account: input.account, opId: input.opId, transaction,
        });
        await assertAvailable();
        return signed;
      },
    });
    return {
      account,
      assertAvailable,
      signChild: (request) => account.signTransaction(request),
      broadcast: async (client, request, options) => {
        // Do not hold the wallet lock across device interaction: lock/removal
        // must be able to invalidate a pending hardware approval.
        const prepared = await client.prepareTransactionRequest(request as never);
        const serializedTransaction = await client.signTransaction(prepared as never);
        return withStorageLock(WALLET_SECRET_OPERATION_LOCK_KEY, async () => {
          await assertAvailable();
          await options.beforeBroadcast?.({ serializedTransaction, transactionHash: keccak256(serializedTransaction) });
          const result = await broadcastSerializedTransaction(client, serializedTransaction, options);
          return { ...result, signedGasLimit: prepared.gas };
        });
      },
    };
  },
} satisfies SignerFactories;

export function createRawForceInclusionSigner<Type extends RawForceInclusionAccountType>(
  input: FactoryInput<Type>,
): Promise<RawForceInclusionSigner> {
  // Preserve the mapped key/input relationship through the indexed dispatch.
  const factories: SignerFactories = RAW_FORCE_INCLUSION_SIGNERS;
  return (factories[input.account.type] as (value: FactoryInput<Type>) => Promise<RawForceInclusionSigner>)(input);
}

function bindAuthority(expected: RawForceInclusionAccount, signal?: AbortSignal) {
  const epoch = getAuthCeremonyEpoch();
  return async () => {
    const current = await getAccountById(expected.id);
    if (signal?.aborted || !isCurrentAuthCeremonyEpoch(epoch) || !getPasswordType()) {
      throw new Error("Wallet authorization changed during signing");
    }
    if (!current || current.type !== expected.type || current.address.toLowerCase() !== expected.address.toLowerCase() ||
      (expected.type === "ledger" && (current.type !== "ledger" || current.deviceId !== expected.deviceId || current.hdPath !== expected.hdPath))) {
      throw new Error("Signing account is no longer available");
    }
  };
}
