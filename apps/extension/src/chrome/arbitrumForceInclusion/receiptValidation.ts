import { keccak256, slice, type Hex } from "viem";
import type { decodeDeliveredMessage, decodeInboxMessage } from "./contracts";

/** Inbox._deliverToBridge aliases every sender, including EOAs, modulo uint160. */
export function delayedMessageSender(l1Sender: string): Hex {
  const offset = 0x1111000000000000000000000000000000001111n;
  return `0x${BigInt.asUintN(160, BigInt(l1Sender) + offset).toString(16).padStart(40, "0")}`;
}

export function validateDelayedMessage(
  delivered: ReturnType<typeof decodeDeliveredMessage>,
  sender: string,
  messageData: Hex,
): void {
  if (delivered.kind !== 3) throw new Error("Arbitrum receipt mismatch: message kind");
  if (delivered.sender.toLowerCase() !== delayedMessageSender(sender)) {
    throw new Error("Arbitrum receipt mismatch: aliased sender");
  }
  if (keccak256(messageData).toLowerCase() !== delivered.messageDataHash.toLowerCase()) {
    throw new Error("Arbitrum receipt mismatch: message data hash");
  }
}

export function validateRecoveredMessage(
  delivered: ReturnType<typeof decodeDeliveredMessage>,
  inboxMessage: ReturnType<typeof decodeInboxMessage>,
  sender: string,
  childHash?: string,
): void {
  validateDelayedMessage(delivered, sender, inboxMessage.data);
  if (inboxMessage.messageNum !== delivered.messageIndex) {
    throw new Error("Arbitrum receipt mismatch: message index");
  }
  if (!inboxMessage.data.startsWith("0x04")) {
    throw new Error("Arbitrum receipt mismatch: signed transaction prefix");
  }
  if (childHash && keccak256(slice(inboxMessage.data, 1)).toLowerCase() !== childHash.toLowerCase()) {
    throw new Error("Arbitrum receipt mismatch: child transaction hash");
  }
}
