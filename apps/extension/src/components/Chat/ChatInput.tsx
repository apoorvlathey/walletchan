import { useLayoutEffect, useRef, useState, KeyboardEvent } from "react";
import { HStack, Textarea, IconButton, FormLabel } from "@chakra-ui/react";
import { ArrowUpIcon } from "@chakra-ui/icons";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder = "Message Bankr…" }: ChatInputProps) {
  const [input, setInput] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(120, Math.max(44, field.scrollHeight))}px`;
    field.style.overflowY = field.scrollHeight > 120 ? "auto" : "hidden";
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setInput("");
      fieldRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <HStack as="form" spacing={2} align="end" onSubmit={(event) => {
      event.preventDefault();
      handleSend();
    }}>
      <FormLabel htmlFor="bankr-chat-message" srOnly m={0}>Message Bankr</FormLabel>
      <Textarea ref={fieldRef} id="bankr-chat-message" rows={1} resize="none"
        value={input} onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown} placeholder={placeholder}
        minH="44px" maxH="120px" py="10px" lineHeight="22px" fontSize="16px"
        bg="surface.sunken" color="fg.primary" borderColor="border.default"
        _placeholder={{ color: "fg.muted" }}
        autoComplete="off" enterKeyHint="send" maxLength={10000}
        _focus={{ borderColor: "accent.highlight", boxShadow: "none" }}
        _focusVisible={{ borderColor: "accent.highlight", boxShadow: "0 0 0 1px var(--chakra-colors-accent-highlight)" }}
      />
      <IconButton type="submit" aria-label={isLoading ? "Bankr is responding" : "Send message"}
        icon={<ArrowUpIcon boxSize={5} />} variant="brand" minW="44px" w="44px" h="44px"
        isDisabled={!input.trim() || isLoading} />
    </HStack>
  );
}

export default ChatInput;
