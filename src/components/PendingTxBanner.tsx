import { HStack, Box, Text, Icon } from "@chakra-ui/react";
import { BellIcon, ChevronRightIcon } from "@chakra-ui/icons";

interface PendingTxBannerProps {
  txCount: number;
  signatureCount: number;
  onClickTx: () => void;
  onClickSignature: () => void;
}

function PendingTxBanner({ txCount, signatureCount, onClickTx, onClickSignature }: PendingTxBannerProps) {
  const totalCount = txCount + signatureCount;
  if (totalCount === 0) return null;

  // Determine the label and action based on what's pending
  const getLabel = () => {
    if (txCount > 0 && signatureCount > 0) {
      return `${txCount} Transaction${txCount > 1 ? "s" : ""}, ${signatureCount} Signature${signatureCount > 1 ? "s" : ""}`;
    } else if (txCount > 0) {
      return `${txCount} Pending Request${txCount > 1 ? "s" : ""}`;
    } else {
      return `${signatureCount} Signature Request${signatureCount > 1 ? "s" : ""}`;
    }
  };

  const handleClick = () => {
    // Prioritize transaction requests over signature requests
    if (txCount > 0) {
      onClickTx();
    } else {
      onClickSignature();
    }
  };

  return (
    <Box
      bg="warning.bg"
      borderWidth="1px"
      borderColor="warning.border"
      borderRadius="lg"
      p={3}
      cursor="pointer"
      onClick={handleClick}
      _hover={{
        bg: "rgba(251,191,36,0.15)",
        borderColor: "warning.solid",
      }}
      transition="all 0.2s"
    >
      <HStack spacing={0}>
        <Box w="40px" flexShrink={0}>
          <Box
            p={1.5}
            bg="warning.solid"
            borderRadius="md"
            w="fit-content"
          >
            <BellIcon boxSize={4} color="bg.base" />
          </Box>
        </Box>
        <Box flex="1" textAlign="center">
          <Text fontSize="sm" fontWeight="600" color="text.primary">
            {getLabel()}
          </Text>
        </Box>
        <Box w="40px" flexShrink={0} display="flex" justifyContent="flex-end">
          <ChevronRightIcon color="warning.solid" />
        </Box>
      </HStack>
    </Box>
  );
}

export default PendingTxBanner;
