import { HStack, Box, Text, Icon } from "@chakra-ui/react";
import { BellIcon, ChevronRightIcon } from "@chakra-ui/icons";

interface PendingTxBannerProps {
  count: number;
  onClick: () => void;
}

function PendingTxBanner({ count, onClick }: PendingTxBannerProps) {
  if (count === 0) return null;

  return (
    <Box
      bg="warning.bg"
      borderWidth="1px"
      borderColor="warning.border"
      borderRadius="lg"
      p={3}
      cursor="pointer"
      onClick={onClick}
      _hover={{
        bg: "rgba(251,191,36,0.15)",
        borderColor: "warning.solid",
      }}
      transition="all 0.2s"
    >
      <HStack justify="space-between">
        <HStack spacing={3}>
          <Box
            p={1.5}
            bg="warning.solid"
            borderRadius="md"
          >
            <BellIcon boxSize={4} color="bg.base" />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="600" color="text.primary">
              {count} Pending Request{count > 1 ? "s" : ""}
            </Text>
            <Text fontSize="xs" color="text.secondary">
              Click to review
            </Text>
          </Box>
        </HStack>
        <ChevronRightIcon color="warning.solid" />
      </HStack>
    </Box>
  );
}

export default PendingTxBanner;
