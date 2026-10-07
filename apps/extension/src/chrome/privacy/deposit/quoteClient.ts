import {
  createPublicClient,
  BaseError,
  InsufficientFundsError,
  encodeFunctionData,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";

import { estimateFees } from "../../gas/feeEstimator";
import { DEFAULT_GAS_BUFFER_PCT } from "../../gas/singlePolicy";
import { secureHttpTransport } from "../../network/rpcClient";
import { PRIVACY_POOLS_VIEM_CHAIN } from "../deployment/chain";
import { PRIVACY_POOLS_DEPLOYMENT } from "../deployment/manifest";
import { PRIVACY_POOLS_RPC_BATCH_SIZE } from "../rpcPolicy";
import { PrivacyShieldQuoteError } from "./quotePolicy";

const ENTRYPOINT_DEPOSIT_ABI = parseAbi([
  "function deposit(uint256 precommitment) payable returns (uint256)",
]);
const SNARK_SCALAR_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;

export interface PrivacyShieldRpcQuote {
  readonly balanceWei: bigint;
  readonly gasLimit: bigint;
  readonly maxFeePerGas: bigint;
}

function createPublicQuotePrecommitment(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return (value % (SNARK_SCALAR_FIELD - 1n)) + 1n;
}

/** Simulate the exact native-deposit call without deriving or persisting a note. */
export async function readPrivacyShieldRpcQuote(
  rpcUrl: string,
  sourceAddress: Address,
  amountWei: bigint,
  overrides: Partial<{
    createClient: (rpcUrl: string) => PublicClient;
    estimateFees: typeof estimateFees;
  }> = {},
): Promise<PrivacyShieldRpcQuote> {
  const client = overrides.createClient?.(rpcUrl) ?? createPublicClient({
    chain: PRIVACY_POOLS_VIEM_CHAIN,
    transport: secureHttpTransport(rpcUrl, {
      batch: { batchSize: PRIVACY_POOLS_RPC_BATCH_SIZE, wait: 0 },
      retryCount: 1,
      timeout: 12_000,
    }),
  });
  const data = encodeFunctionData({
    abi: ENTRYPOINT_DEPOSIT_ABI,
    functionName: "deposit",
    args: [createPublicQuotePrecommitment()],
  });

  // Check the real source balance before estimation: RPC nodes can reject an
  // unfunded deposit before returning gas, hiding the useful balance failure.
  const balanceWei = await client.getBalance({ address: sourceAddress });
  if (balanceWei < PRIVACY_POOLS_DEPLOYMENT.assetConfig.minimumDepositAmount) {
    throw new PrivacyShieldQuoteError("balance-below-minimum");
  }
  if (balanceWei < amountWei) {
    throw new PrivacyShieldQuoteError("insufficient-funds");
  }
  const [estimatedGas, fees] = await Promise.all([
    client.estimateGas({
      account: sourceAddress,
      to: PRIVACY_POOLS_DEPLOYMENT.contracts.entrypointProxy.address,
      data,
      value: amountWei,
    }).catch((error: unknown) => {
      if (error instanceof BaseError && error.walk(
        (cause) => cause instanceof InsufficientFundsError,
      ) instanceof InsufficientFundsError) {
        throw new PrivacyShieldQuoteError("insufficient-funds");
      }
      throw error;
    }),
    (overrides.estimateFees ?? estimateFees)(client, PRIVACY_POOLS_DEPLOYMENT.chainId),
  ]);
  if (!fees || fees.maxFeePerGas <= 0n || estimatedGas <= 0n) {
    throw new Error("Privacy Shield fee estimate unavailable");
  }
  const gasLimit =
    (estimatedGas * BigInt(100 + DEFAULT_GAS_BUFFER_PCT)) / 100n;
  return Object.freeze({
    balanceWei,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
  });
}
