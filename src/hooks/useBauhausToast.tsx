import { useToast, UseToastOptions, Box, HStack, Text, CloseButton, Icon } from "@chakra-ui/react";
import { CheckIcon, WarningIcon, InfoIcon } from "@chakra-ui/icons";

type ToastStatus = "info" | "warning" | "success" | "error";

interface BauhausToastOptions extends Omit<UseToastOptions, "render"> {
  title?: string;
  description?: string;
  status?: ToastStatus;
}

const statusConfig: Record<ToastStatus, { bg: string; text: string; iconBg: string; iconColor: string }> = {
  info: { bg: "#1040C0", text: "white", iconBg: "white", iconColor: "#1040C0" },
  success: { bg: "#F0C020", text: "#121212", iconBg: "#121212", iconColor: "#F0C020" },
  warning: { bg: "#F0C020", text: "#121212", iconBg: "#121212", iconColor: "#F0C020" },
  error: { bg: "#D02020", text: "white", iconBg: "white", iconColor: "#D02020" },
};

const StatusIcon = ({ status }: { status: ToastStatus }) => {
  switch (status) {
    case "success":
      return <CheckIcon boxSize={3} />;
    case "error":
      return <WarningIcon boxSize={3} />;
    case "warning":
      return <WarningIcon boxSize={3} />;
    case "info":
    default:
      return <InfoIcon boxSize={3} />;
  }
};

export function useBauhausToast() {
  const toast = useToast();

  return (options: BauhausToastOptions) => {
    const status = options.status || "info";
    const config = statusConfig[status];

    return toast({
      position: options.position || "bottom",
      duration: options.duration ?? 4000,
      isClosable: options.isClosable ?? true,
      ...options,
      render: ({ onClose }) => (
        <Box
          bg={config.bg}
          color={config.text}
          border="3px solid"
          borderColor="#121212"
          boxShadow="4px 4px 0px 0px #121212"
          px={4}
          py={3}
          position="relative"
        >
          {/* Corner geometric decoration */}
          <Box
            position="absolute"
            top="-3px"
            right="-3px"
            w="8px"
            h="8px"
            bg={status === "error" ? "#F0C020" : status === "info" ? "#D02020" : "#1040C0"}
            border="2px solid"
            borderColor="#121212"
          />

          <HStack spacing={3} align="flex-start">
            {/* Status icon in geometric container */}
            <Box
              bg={config.iconBg}
              color={config.iconColor}
              p={1.5}
              border="2px solid"
              borderColor="#121212"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <StatusIcon status={status} />
            </Box>

            <Box flex={1}>
              {options.title && (
                <Text
                  fontWeight="700"
                  fontSize="sm"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  mb={options.description ? 0.5 : 0}
                >
                  {options.title}
                </Text>
              )}
              {options.description && (
                <Text fontWeight="500" fontSize="sm" opacity={0.9}>
                  {options.description}
                </Text>
              )}
            </Box>

            {options.isClosable !== false && (
              <CloseButton
                size="sm"
                color={config.text}
                onClick={onClose}
                _hover={{ bg: "whiteAlpha.200" }}
              />
            )}
          </HStack>
        </Box>
      ),
    });
  };
}
