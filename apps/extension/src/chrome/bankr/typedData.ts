import { BankrApiError } from "./response";

/** Preserve the EIP-712 value while adapting its chain ID to Bankr's JSON API. */
export function normalizeBankrTypedDataChainId(typedData: unknown): unknown {
  if (!typedData || typeof typedData !== "object" || Array.isArray(typedData)) {
    throw new BankrApiError("Invalid EIP-712 typed data");
  }
  const domain = (typedData as Record<string, unknown>).domain;
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) {
    throw new BankrApiError("Invalid EIP-712 domain");
  }
  const rawChainId = (domain as Record<string, unknown>).chainId;
  // Chain ID is optional in EIP-712. Never introduce one if it is absent.
  if (rawChainId === undefined) return typedData;
  if (typeof rawChainId === "number") {
    if (!Number.isSafeInteger(rawChainId) || rawChainId <= 0) {
      throw new BankrApiError("Invalid EIP-712 domain chainId");
    }
    return typedData;
  }
  if (
    typeof rawChainId !== "bigint" &&
    !(typeof rawChainId === "string" &&
      (/^\d+$/.test(rawChainId) || /^0x[0-9a-f]+$/i.test(rawChainId)))
  ) {
    throw new BankrApiError("Invalid EIP-712 domain chainId");
  }
  const chainId = BigInt(rawChainId);
  if (chainId <= 0n || chainId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BankrApiError("EIP-712 domain chainId is out of range");
  }
  return { ...typedData, domain: { ...domain, chainId: Number(chainId) } };
}
