"use client";

import { Box, IconButton, useDisclosure } from "@chakra-ui/react";
import { History } from "lucide-react";
import { useBridgeHistory } from "./useBridgeHistory";
import BridgeHistoryDrawer from "./BridgeHistoryDrawer";

export function useBridgeHistoryContext() {
  return useBridgeHistory();
}

export function BridgeHistoryButton({
  hasActionable,
  onOpen,
}: {
  hasActionable: boolean;
  onOpen: () => void;
}) {
  return (
    <Box position="relative" display="inline-block">
      <IconButton
        aria-label="Bridge history"
        icon={<History size={20} />}
        variant="ghost"
        size="sm"
        onClick={onOpen}
      />
      {hasActionable && (
        <Box
          position="absolute"
          top="6px"
          right="6px"
          w="8px"
          h="8px"
          borderRadius="full"
          bg="bauhaus.red"
          pointerEvents="none"
        />
      )}
    </Box>
  );
}

export function BridgeHistoryWidget({
  history,
}: {
  history: ReturnType<typeof useBridgeHistory>;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <BridgeHistoryButton hasActionable={history.hasActionable} onOpen={onOpen} />
      <BridgeHistoryDrawer
        isOpen={isOpen}
        onClose={onClose}
        entries={history.entries}
        updateEntry={history.updateEntry}
        removeEntry={history.removeEntry}
      />
    </>
  );
}
