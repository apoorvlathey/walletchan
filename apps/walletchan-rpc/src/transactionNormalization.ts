import { RpcError } from "./rpcTypes.js";

/**
 * Normalizes the transaction calldata alias used by Foundry/Alloy before the
 * request crosses the wallet boundary. EIP-1193 wallets conventionally read
 * `data`, while Foundry serializes unlocked transactions with `input`.
 */
export function normalizeSendTransactionInput(
  transaction: Record<string, unknown>,
): Record<string, unknown> {
  const data = transaction.data;
  const input = transaction.input;
  const hasData = data !== undefined && data !== null;
  const hasInput = input !== undefined && input !== null;

  if (hasInput && typeof input !== "string") {
    throw new RpcError(-32602, "Transaction 'input' must be a hex data string");
  }
  if (hasData && hasInput && data !== input) {
    throw new RpcError(-32602, "Transaction 'data' and 'input' must match");
  }

  const normalized = { ...transaction };
  delete normalized.input;
  if (!hasData && hasInput) normalized.data = input;
  return normalized;
}
