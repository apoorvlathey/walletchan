import { decodeFunctionData, encodeFunctionData, parseAbi, toHex } from "viem";
import { decodeSafeExecutionData } from "@/chrome/safe/executionData";
import { decodeMultiSendTransactions } from "@/chrome/safe/multiSend";
import type { ERC5792Call } from "@/chrome/erc5792Types";
import { MULTISEND_FORMAT_KEY } from "@/lib/clearSigning/builtinDescriptors";

const MULTISEND_ABI = parseAbi([`function ${MULTISEND_FORMAT_KEY}`]);

/** Decode input only. Call cards are not proof of execution or contract identity. */
export function decodeExplorerSafeExecution(input: string) {
  const transaction = decodeSafeExecutionData(input);
  if (!transaction) return null;
  let calls: ERC5792Call[] | null = null;
  if (transaction.operation === 0) {
    // The exact Safe ABI decoder has already validated this address.
    calls = [{ to: transaction.to as `0x${string}`, value: toHex(transaction.value), data: transaction.data }];
  } else if (transaction.value === 0n) {
    try {
      const decoded = decodeFunctionData({ abi: MULTISEND_ABI, data: transaction.data });
      if (encodeFunctionData({ abi: MULTISEND_ABI, functionName: "multiSend", args: decoded.args })
        .toLowerCase() === transaction.data.toLowerCase()) {
        calls = decodeMultiSendTransactions(decoded.args![0] as `0x${string}`).map((call) => ({
          to: call.to, value: toHex(BigInt(call.value)), data: call.data,
        }));
      }
    } catch {
      // Unknown delegatecalls and malformed/unsupported batches retain the full decoder.
    }
  }
  return { transaction, calls };
}
