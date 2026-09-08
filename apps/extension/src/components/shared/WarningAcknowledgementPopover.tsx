import type { ReactNode } from "react";
import { ChevronDownIcon, WarningTwoIcon } from "@chakra-ui/icons";
import {
  Button,
  Checkbox,
  HStack,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";

export interface WarningAcknowledgementProps {
  isOpen: boolean;
  isAcknowledged: boolean;
  isDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  children: ReactNode;
  tone?: "error" | "warning";
  matchTriggerWidth?: boolean;
  label?: string;
  title?: string;
  acknowledgement?: string;
}

export function WarningAcknowledgementPopover({
  isOpen,
  isAcknowledged,
  children,
  tone = "error",
  matchTriggerWidth = false,
  label = "Validation warning",
  title = "Sign despite warning",
  acknowledgement = "I understand the warning and want to sign anyway.",
  isDisabled,
  onOpenChange,
  onAcknowledgedChange,
}: WarningAcknowledgementProps) {
  return (
    <Popover
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      placement="top-end"
      matchWidth={matchTriggerWidth}
      gutter={8}
      closeOnBlur
    >
      <PopoverTrigger>
        <Button
          type="button"
          variant="unstyled"
          display="flex"
          w="full"
          minH="44px"
          h="auto"
          px={3}
          py={1}
          onClick={() => {
            if (!isDisabled) onOpenChange(!isOpen);
          }}
          isDisabled={isDisabled}
          aria-expanded={isOpen}
          borderWidth="1px"
          borderColor={`status.${tone}.border`}
          borderRadius="lg"
          bg={`status.${tone}.bg`}
          fontWeight="inherit"
          textTransform="none"
          _hover={{
            bg: `status.${tone}.bg`,
            borderColor: `status.${tone}.emphasis`,
          }}
          _focus={{ outline: "none" }}
          _focusVisible={{ boxShadow: "focus" }}
          justifyContent="space-between"
        >
          <HStack spacing={2} minW={0} flex={1}>
            <WarningTwoIcon
              color={`status.${tone}.emphasis`}
              boxSize="14px"
              flexShrink={0}
            />
            <Text color={`status.${tone}.fg`} fontSize="xs" fontWeight="600" noOfLines={1}>
              {label}
            </Text>
          </HStack>
          <HStack spacing={1.5} minW={0} flexShrink={0} ml={2} justify="flex-end">
            {isAcknowledged && (
              <Text
                color="status.success.fg"
                fontSize="xs"
                fontWeight="700"
                noOfLines={1}
              >
                Acknowledged
              </Text>
            )}
            <ChevronDownIcon
              boxSize={4}
              color="fg.muted"
              transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
              transitionProperty="transform"
              transitionDuration="fast"
              aria-hidden
            />
          </HStack>
        </Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          w={matchTriggerWidth ? "full" : "300px"}
          maxW="calc(100vw - 32px)"
          maxH="calc(100vh - 96px)"
        >
          <PopoverBody p={3} overflowY="auto" overflowX="hidden">
            <VStack align="stretch" spacing={3}>
              <VStack align="stretch" spacing={matchTriggerWidth ? 3 : 1}>
                <HStack align="center" spacing={2}>
                  <WarningTwoIcon
                    color={`status.${tone}.emphasis`}
                    boxSize="14px"
                    flexShrink={0}
                  />
                  <Text color="fg.primary" fontSize="sm" fontWeight="700">
                    {title}
                  </Text>
                </HStack>
                <VStack align="stretch" color="fg.secondary" fontSize="xs" spacing={3}>
                  {children}
                </VStack>
              </VStack>
              <Checkbox
                minH={matchTriggerWidth ? "auto" : undefined}
                isChecked={isAcknowledged}
                isDisabled={isDisabled}
                onChange={(event) =>
                  onAcknowledgedChange(event.target.checked)
                }
                alignItems="flex-start"
                sx={{
                  "& .chakra-checkbox__control[data-checked]": {
                    bg: "accent.highlight",
                    borderColor: "accent.highlight",
                    color: "accentFg.highlight",
                  },
                  "& .chakra-checkbox__control[data-checked]:hover": {
                    bg: "accent.highlight",
                    borderColor: "accent.highlight",
                  },
                }}
              >
                <Text color="fg.primary" fontSize="sm" lineHeight="1.4">
                  {acknowledgement}
                </Text>
              </Checkbox>
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
