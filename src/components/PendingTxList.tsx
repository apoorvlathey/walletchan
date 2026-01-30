import {
  Box,
  VStack,
  HStack,
  Text,
  IconButton,
  Badge,
  Image,
  Heading,
  Spacer,
  Button,
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";
import { getChainConfig } from "@/constants/chainConfig";

interface PendingTxListProps {
  requests: PendingTxRequest[];
  onBack: () => void;
  onSelectTx: (txRequest: PendingTxRequest) => void;
  onRejectAll: () => void;
}

function PendingTxList({ requests, onBack, onSelectTx, onRejectAll }: PendingTxListProps) {
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={4} align="stretch">
        <HStack>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
          <Heading size="sm" color="text.primary">
            Pending Requests
          </Heading>
          <Spacer />
          <Badge
            bg="warning.bg"
            color="warning.solid"
            borderWidth="1px"
            borderColor="warning.border"
            borderRadius="full"
            px={2}
          >
            {requests.length}
          </Badge>
        </HStack>

        <VStack spacing={2} align="stretch">
          {requests.map((request, index) => {
            const config = getChainConfig(request.tx.chainId);
            return (
              <Box
                key={request.id}
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="lg"
                p={3}
                cursor="pointer"
                onClick={() => onSelectTx(request)}
                _hover={{
                  bg: "bg.emphasis",
                  borderColor: "border.strong",
                }}
                transition="all 0.2s"
              >
                <HStack justify="space-between">
                  <HStack spacing={3} flex={1}>
                    <Badge
                      bg="bg.muted"
                      color="text.secondary"
                      fontSize="xs"
                      minW="24px"
                      textAlign="center"
                      borderRadius="md"
                    >
                      #{index + 1}
                    </Badge>
                    <Image
                      src={
                        request.favicon ||
                        `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`
                      }
                      alt="favicon"
                      boxSize="28px"
                      borderRadius="md"
                      bg="bg.muted"
                      p={1}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`;
                      }}
                    />
                    <Box flex={1}>
                      <HStack justify="space-between">
                        <Text
                          fontSize="sm"
                          fontWeight="500"
                          color="text.primary"
                          noOfLines={1}
                        >
                          {new URL(request.origin).hostname}
                        </Text>
                        <Text fontSize="xs" color="text.tertiary">
                          {formatTimestamp(request.timestamp)}
                        </Text>
                      </HStack>
                      <HStack spacing={2} mt={1}>
                        <Badge
                          fontSize="xs"
                          bg={config.bg}
                          color={config.text}
                          borderWidth="1px"
                          borderColor={config.border}
                          borderRadius="full"
                          px={2}
                          py={0.5}
                          display="flex"
                          alignItems="center"
                          gap={1}
                        >
                          {config.icon && (
                            <Image
                              src={config.icon}
                              alt={request.chainName}
                              boxSize="10px"
                            />
                          )}
                          {request.chainName}
                        </Badge>
                        <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                          {request.tx.to.slice(0, 6)}...{request.tx.to.slice(-4)}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>
                  <ChevronRightIcon color="text.tertiary" />
                </HStack>
              </Box>
            );
          })}
        </VStack>

        {requests.length === 0 && (
          <Box textAlign="center" py={8}>
            <Text color="text.secondary">No pending requests</Text>
          </Box>
        )}

        {requests.length > 0 && (
          <Button
            variant="outline"
            w="full"
            borderColor="error.solid"
            color="error.solid"
            _hover={{ bg: "error.bg" }}
            onClick={onRejectAll}
          >
            Reject All ({requests.length})
          </Button>
        )}
      </VStack>
    </Box>
  );
}

export default PendingTxList;
