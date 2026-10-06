import ChatView from "@/components/Chat/ChatView";

export default function ChatPreview({ scenario }: { scenario: string }) {
  return <ChatView onBack={() => {}} startWithNewChat={scenario === "new"}
    returnToConversationId={scenario !== "new" && scenario !== "history" ? "preview-chat" : undefined}
    isWalletUnlocked={scenario !== "locked"} onUnlock={() => {}} />;
}
