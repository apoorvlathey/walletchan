import { decodeFunctionData, encodeFunctionData } from "viem";
import metadata from "./deploymentMetadata.generated.json";
import { decodeMultiSendTransactions } from "./multiSend";

const SAFE_TX_FIELDS = [
  ["to", "address"], ["value", "uint256"], ["data", "bytes"],
  ["operation", "uint8"], ["safeTxGas", "uint256"], ["baseGas", "uint256"],
  ["gasPrice", "uint256"], ["gasToken", "address"], ["refundReceiver", "address"],
  ["nonce", "uint256"],
] as const;
const MULTISEND_ABI = [{
  type: "function", name: "multiSend", stateMutability: "payable",
  inputs: [{ name: "transactions", type: "bytes" }], outputs: [],
}] as const;
// The existing decoder allows 100 entries, 85-byte headers, and 128 KiB of data.
const MAX_MULTISEND_BYTES = 4 + 64 + 100 * 85 + 128 * 1024 + 32;

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}
function uint(value: unknown): bigint | null {
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return null;
    const parsed = BigInt(value);
    return parsed < 1n << 256n ? parsed : null;
  }
  if (typeof value === "bigint") return value >= 0n && value < 1n << 256n ? value : null;
  if (typeof value !== "string") return null;
  // Match the integer spellings accepted by BigInt/typed-data signing. Leading
  // zero padding must not hide a positive refund, and must be removed before
  // applying the numeric size bound. Input bytes are bounded at provider intake.
  const text = value.trim();
  let normalized: string;
  if (/^\+?[0-9]+$/.test(text)) {
    normalized = text.replace(/^\+?0*/, "") || "0";
    if (normalized.length > 78) return null;
  } else {
    const match = /^(0[xX])([0-9a-fA-F]+)$|^(0[bB])([01]+)$|^(0[oO])([0-7]+)$/.exec(text);
    if (!match) return null;
    const prefix = match[1] ?? match[3] ?? match[5];
    const digits = (match[2] ?? match[4] ?? match[6]).replace(/^0+/, "") || "0";
    const maxDigits = prefix.toLowerCase() === "0x" ? 64 : prefix.toLowerCase() === "0b" ? 256 : 86;
    if (digits.length > maxDigits) return null;
    normalized = prefix + digits;
  }
  const parsed = BigInt(normalized);
  return parsed < 1n << 256n ? parsed : null;
}
function address(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export interface SafeTransactionRisk {
  delegatecall: boolean;
  refund: { gasToken: string; refundReceiver: string } | null;
}

function knownMultiSend(chainId: number, to: unknown): boolean {
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !address(to)) return false;
  // Deliberately do not use getCanonicalMultiSendAddress: its global fallback
  // is useful for construction, but cannot establish a deployment on this chain.
  return (Object.keys(metadata.artifacts) as Array<keyof typeof metadata.artifacts>).some((version) => {
    const aliases = metadata.networkAliases[version] as Record<string, string | string[]>;
    const configured = aliases[String(chainId)];
    if (!configured) return false;
    const deployment = metadata.artifacts[version].multiSend;
    const deployments = deployment.deployments as Record<string, { address: string }>;
    return deployment.released && (Array.isArray(configured) ? configured : [configured])
      .some((alias) => deployments[alias]?.address.toLowerCase() === to.toLowerCase());
  });
}

function verifiedCallOnlyBatch(transaction: RecordValue, chainId: number): boolean {
  if (!knownMultiSend(chainId, transaction.to) || uint(transaction.value) !== 0n) return false;
  const data = transaction.data;
  if (typeof data !== "string" || data.length > MAX_MULTISEND_BYTES * 2 + 2 ||
      !/^0x(?:[0-9a-fA-F]{2})*$/.test(data)) return false;
  try {
    const decoded = decodeFunctionData({ abi: MULTISEND_ABI, data: data as `0x${string}` });
    // Require the complete canonical ABI envelope, including offset and padding;
    // permissive decoding must not silently discard unreviewed trailing bytes.
    if (encodeFunctionData({ abi: MULTISEND_ABI, functionName: "multiSend", args: decoded.args })
      .toLowerCase() !== data.toLowerCase()) return false;
    decodeMultiSendTransactions(decoded.args[0]);
    return true;
  } catch {
    // Inner delegatecalls, nested delegatecall wrappers and malformed/oversized
    // batches all retain the warning. Never recurse to grant an exemption.
    return false;
  }
}

/** Presentation-only analysis: never rewrites the transaction or authorizes signing. */
export function analyzeSafeTransactionRisk(transaction: unknown, chainId: number): SafeTransactionRisk {
  const message = record(transaction) ?? {};
  const operation = uint(message.operation);
  const gasPrice = uint(message.gasPrice);
  return {
    delegatecall: operation !== 0n && !(operation === 1n && verifiedCallOnlyBatch(message, chainId)),
    // Unknown numeric forms must not hide a payment: some signer libraries
    // coerce arrays or other noncanonical values. Only proven zero is exempt.
    refund: gasPrice !== 0n && address(message.gasToken) && address(message.refundReceiver)
      ? { gasToken: message.gasToken, refundReceiver: message.refundReceiver } : null,
  };
}

/** Recognize the actual signed SafeTx type, not a dapp-supplied friendly name. */
export function analyzeSafeTypedDataRisk(typedData: unknown, requestChainId: number): SafeTransactionRisk | null {
  const data = record(typedData);
  if (!data || data.primaryType !== "SafeTx") return null;
  const fields = record(data.types)?.SafeTx;
  if (!Array.isArray(fields) || fields.length !== SAFE_TX_FIELDS.length ||
      !SAFE_TX_FIELDS.every(([name, type], index) => {
        const field = record(fields[index]);
        return field?.name === name && field.type === type;
      })) return null;
  const domain = record(data.domain);
  const domainFields = record(data.types)?.EIP712Domain;
  const canonicalDomain = Array.isArray(domainFields) && domainFields.length === 2 &&
    record(domainFields[0])?.name === "chainId" && record(domainFields[0])?.type === "uint256" &&
    record(domainFields[1])?.name === "verifyingContract" && record(domainFields[1])?.type === "address";
  const exactChain = Number.isSafeInteger(requestChainId) && requestChainId > 0 &&
    (typeof domain?.chainId === "string" || typeof domain?.chainId === "number") &&
    uint(domain?.chainId) === BigInt(requestChainId);
  // Missing/legacy/ambiguous domains can still be recognized for warnings, but
  // cannot establish the network identity required to suppress delegatecall.
  const chainId = canonicalDomain && exactChain && address(domain?.verifyingContract) ? requestChainId : 0;
  return analyzeSafeTransactionRisk(data.message, chainId);
}
