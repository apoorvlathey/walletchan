import { HStack, Box, Text } from "@chakra-ui/react";
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
      bg="bauhaus.yellow"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      p={3}
      cursor="pointer"
      onClick={handleClick}
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "6px 6px 0px 0px #121212",
      }}
      _active={{
        transform: "translate(2px, 2px)",
        boxShadow: "none",
      }}
      transition="all 0.2s ease-out"
      position="relative"
    >
      {/* Corner decoration */}
      <Box
        position="absolute"
        top="-3px"
        right="-3px"
        w="10px"
        h="10px"
        bg="bauhaus.red"
        border="2px solid"
        borderColor="bauhaus.black"
      />

      <HStack spacing={0}>
        <Box w="40px" flexShrink={0}>
          <Box
            p={1.5}
            bg="bauhaus.black"
            w="fit-content"
          >
            <BellIcon boxSize={4} color="bauhaus.yellow" />
          </Box>
        </Box>
        <Box flex="1" textAlign="center">
          <Text fontSize="sm" fontWeight="700" color="bauhaus.black" textTransform="uppercase" letterSpacing="wider">
            {getLabel()}
          </Text>
        </Box>
        <Box w="40px" flexShrink={0} display="flex" justifyContent="flex-end">
          <Box bg="bauhaus.black" p={1}>
            <ChevronRightIcon color="bauhaus.yellow" />
          </Box>
        </Box>
      </HStack>
    </Box>
  );
}

export default PendingTxBanner;
