/** Frozen public-only chat states for visual and interaction QA. */
import type { Conversation, Message } from "@/chrome/bankr/chat/storage";
import { PREVIEW_EPOCH_MS } from "./fixtures";

export function createPreviewChatHistory(scenario: string): Conversation[] {
  const message = (id: string, role: Message["role"], content: string, status: Message["status"] = "complete"): Message =>
    ({ id, role, content, status, timestamp: PREVIEW_EPOCH_MS });
  const reply = scenario === "access-error" ? message("reply", "assistant",
    "Bankr chat requires Agent API access. Open https://bankr.bot/api-keys, enable Agent API access for the API key you use in WalletChan, then send your message again.", "error") :
    scenario === "error" ? message("reply", "assistant", "Bankr is temporarily unavailable. Please try again in a moment.", "error") :
    scenario === "locked" ? { ...message("reply", "assistant", "Wallet is locked. Please unlock first.", "error"), isWalletLockedError: true } :
    scenario === "pending" ? message("reply", "assistant", "", "pending") :
    message("reply", "assistant", "You can ask me about token balances, compare swap routes, or explore DeFi. What would you like to do?");
  return [{ id: "preview-chat", title: "Getting started", createdAt: PREVIEW_EPOCH_MS,
    updatedAt: PREVIEW_EPOCH_MS, messages: [message("user", "user", "What can you help me with?"), reply] }];
}
