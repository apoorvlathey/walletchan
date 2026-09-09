import { CheckIcon, CopyIcon } from "@chakra-ui/icons";
import { Button, HStack, IconButton, Text, useClipboard } from "@chakra-ui/react";
import { feeQuoteErrorSummary } from "./model/quoteError";

export function FeeQuoteError({ error, isSwap, disabled, onRetry }: {
  error: string;
  isSwap: boolean;
  disabled?: boolean;
  onRetry: () => void;
}) {
  const { onCopy, hasCopied } = useClipboard(error);
  return (
    <HStack w="full" minW={0} align="start" spacing={2} data-fee-quote-error>
      <Text
        flex="1" minW={0} color="status.error.fg" fontSize="xs"
        lineHeight="short" noOfLines={3} overflowWrap="anywhere" role="alert"
      >
        {feeQuoteErrorSummary(error, isSwap)}
      </Text>
      <HStack spacing={1} flexShrink={0}>
        <IconButton
          aria-label={hasCopied ? "Error copied" : "Copy full error"}
          title={hasCopied ? "Error copied" : "Copy full error"}
          icon={hasCopied ? <CheckIcon /> : <CopyIcon />}
          size="xs" minW="28px" h="28px" variant="ghost"
          color="fg.secondary" onClick={onCopy}
        />
        <Button size="xs" h="28px" variant="ghost" color="status.error.fg"
          isDisabled={disabled} onClick={onRetry}>
          Retry
        </Button>
      </HStack>
    </HStack>
  );
}
