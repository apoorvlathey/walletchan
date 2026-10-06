import { useEffect, useRef, useState } from "react";
import { Box, Button, HStack, IconButton, Link, Text, VStack } from "@chakra-ui/react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, LockIcon, RepeatIcon, WarningTwoIcon } from "@chakra-ui/icons";
import type { Message } from "@/chrome/bankr/chat/storage";
import { BANKR_BOT_API_KEYS_PAGE } from "@/constants/externalUrls";
import { sanitizeExternalNavigationUrl } from "@/lib/externalNavigation";
import { useThemedToast } from "@/hooks/useThemedToast";
import ShapesLoader from "./ShapesLoader";

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;

function contentWithLinks(content: string): React.ReactNode[] {
  return content.split(URL_REGEX).map((part, index) => {
    const url = sanitizeExternalNavigationUrl(part);
    return url ? (
      <Link key={index} href={url} isExternal color="accent.highlight"
        textDecoration="underline" textUnderlineOffset="3px" overflowWrap="anywhere"
        onClick={(event) => { event.preventDefault(); void chrome.tabs.create({ url }); }}>
        {part}
      </Link>
    ) : part;
  });
}

interface MessageBubbleProps {
  message: Message;
  statusText?: string | null;
  isWalletUnlocked?: boolean;
  onUnlock?: () => void;
  onRetry?: () => void;
  onResend?: (content: string) => void;
  isBusy?: boolean;
}

export function MessageBubble({ message, statusText, isWalletUnlocked, onUnlock,
  onRetry, onResend, isBusy = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useThemedToast();
  useEffect(() => () => clearTimeout(timer.current), []);
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const needsAgentAccess = isError && message.content.includes("Agent API access");
  const missingReply = needsAgentAccess && message.content.startsWith("Bankr returned no chat response");
  const locked = isError && message.isWalletLockedError;
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy message", status: "error" });
    }
  };

  if (message.status === "pending") {
    return (
      <Box as="article" py={3}>
        <HStack role="status" aria-live="polite" spacing={3} minH="44px">
          <ShapesLoader size="6px" />
          <VStack align="start" spacing={0} minW={0}>
            <Text fontSize="sm" fontWeight={500} color="fg.primary">Bankr is working</Text>
            <Text fontSize="xs" color="fg.secondary" noOfLines={2}>
              {statusText || "Preparing a response…"}
            </Text>
          </VStack>
        </HStack>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box as="article" py={3}>
        <Box role="alert" bg="surface.raised" border="1px solid"
          borderColor={needsAgentAccess || locked ? "status.warning.border" : "status.error.border"}
          borderRadius="lg" p={3}>
          <HStack align="start" spacing={2} mb={2}>
            <WarningTwoIcon mt="3px" boxSize={3.5}
              color={needsAgentAccess || locked ? "status.warning.emphasis" : "status.error.emphasis"} />
            <Text fontSize="sm" fontWeight={600} color="fg.primary">
              {needsAgentAccess ? (missingReply ? "No reply from Bankr" : "Enable Bankr chat") : locked ?
                (isWalletUnlocked ? "Ready to try again" : "Unlock to continue") : "Bankr couldn’t respond"}
            </Text>
          </HStack>
          <Text fontSize="sm" color="fg.secondary" lineHeight="1.55" whiteSpace="pre-wrap" overflowWrap="anywhere">
            {needsAgentAccess ? (missingReply ? "Bankr returned an empty reply. Check Agent API access for your WalletChan key in Bankr's API settings, then try again." :
              "Enable Agent API access for your WalletChan key in Bankr's API settings, then try again.") :
              locked && isWalletUnlocked ? "Your wallet is unlocked. You can now resend your message." : contentWithLinks(message.content)}
          </Text>
          <HStack mt={3} spacing={2} flexWrap="wrap" rowGap={2}>
            {needsAgentAccess && (
              <Button size="sm" minH="40px" variant="brand" rightIcon={<ExternalLinkIcon boxSize={3} />}
                onClick={() => { void chrome.tabs.create({ url: BANKR_BOT_API_KEYS_PAGE }); }}>
                Open API settings
              </Button>
            )}
            {locked && !isWalletUnlocked && onUnlock ? (
              <Button size="sm" minH="40px" variant="brand" leftIcon={<LockIcon />} onClick={onUnlock}>
                Unlock wallet
              </Button>
            ) : onRetry && (
              <Button size="sm" minH="40px" variant="secondary" leftIcon={<RepeatIcon boxSize={3.5} />}
                onClick={onRetry} isDisabled={isBusy}>Try again</Button>
            )}
          </HStack>
        </Box>
      </Box>
    );
  }

  return (
    <VStack as="article" align={isUser ? "end" : "stretch"} spacing={1} py={3}>
      {!isUser && <Text fontSize="xs" fontWeight={600} color="fg.secondary">Bankr</Text>}
      <Box maxW={isUser ? "88%" : "full"} bg={isUser ? "surface.raised" : "transparent"}
        borderRadius={isUser ? "lg" : 0} px={isUser ? 3 : 0} py={isUser ? 2.5 : 0}>
        <Text fontSize="sm" color="fg.primary" lineHeight="1.6" whiteSpace="pre-wrap" overflowWrap="anywhere">
          {contentWithLinks(message.content)}
        </Text>
      </Box>
      <HStack spacing={0} justify={isUser ? "end" : "start"} minH="32px">
        <Text fontSize="xs" color="fg.muted" mr={2} sx={{ fontVariantNumeric: "tabular-nums" }}>{time}</Text>
        <IconButton aria-label={copied ? "Message copied" : "Copy message"} title={copied ? "Copied" : "Copy"}
          icon={copied ? <CheckIcon boxSize={3} /> : <CopyIcon boxSize={3.5} />}
          variant="ghost" size="xs" minW="32px" w="32px" h="32px"
          color={copied ? "accent.highlight" : "fg.muted"} onClick={copy} />
        <Text srOnly aria-live="polite">{copied ? "Message copied" : ""}</Text>
        {isUser && onResend && (
          <IconButton aria-label="Send this message again" title="Resend"
            icon={<RepeatIcon boxSize={3.5} />} variant="ghost" size="xs"
            minW="32px" w="32px" h="32px" color="fg.muted"
            isDisabled={isBusy} onClick={() => onResend(message.content)} />
        )}
      </HStack>
    </VStack>
  );
}

export default MessageBubble;
