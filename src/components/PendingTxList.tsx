import { memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  IconButton,
  Badge,
  Image,
  Spacer,
  Button,
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";
import { PendingSignatureRequest } from "@/chrome/pendingSignatureStorage";
import { getChainConfig } from "@/constants/chainConfig";

interface PendingTxListProps {
  txRequests: PendingTxRequest[];
  signatureRequests: PendingSignatureRequest[];
  onBack: () => void;
  onSelectTx: (txRequest: PendingTxRequest) => void;
  onSelectSignature: (sigRequest: PendingSignatureRequest) => void;
  onRejectAll: () => void;
}

function PendingTxList({ txRequests, signatureRequests, onBack, onSelectTx, onSelectSignature, onRejectAll }: PendingTxListProps) {
  const totalCount = txRequests.length + signatureRequests.length;

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

  const getMethodDisplayName = (method: string): string => {
    switch (method) {
      case "personal_sign":
        return "Personal Sign";
      case "eth_sign":
        return "Eth Sign";
      case "eth_signTypedData":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4":
        return "Typed Data";
      default:
        return method;
    }
  };

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
          <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="tight">
            Pending Requests
          </Text>
          <Spacer />
          <Badge
            bg="bauhaus.yellow"
            color="bauhaus.black"
            border="2px solid"
            borderColor="bauhaus.black"
            px={3}
            py={1}
            fontWeight="700"
          >
            {totalCount}
          </Badge>
        </HStack>

        <VStack spacing={3} align="stretch">
          {/* Transaction Requests */}
          {txRequests.map((request, index) => {
            const config = getChainConfig(request.tx.chainId);
            return (
              <Box
                key={request.id}
                bg="bauhaus.white"
                border="3px solid"
                borderColor="bauhaus.black"
                boxShadow="4px 4px 0px 0px #121212"
                p={3}
                cursor="pointer"
                onClick={() => onSelectTx(request)}
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
                  w="8px"
                  h="8px"
                  bg="bauhaus.blue"
                  border="2px solid"
                  borderColor="bauhaus.black"
                />

                <HStack justify="space-between">
                  <HStack spacing={3} flex={1}>
                    <Badge
                      bg="bauhaus.black"
                      color="bauhaus.white"
                      fontSize="xs"
                      minW="28px"
                      textAlign="center"
                      fontWeight="700"
                    >
                      #{index + 1}
                    </Badge>
                    <Box
                      bg="bauhaus.white"
                      border="2px solid"
                      borderColor="bauhaus.black"
                      p={1}
                    >
                      <Image
                        src={
                          request.favicon ||
                          `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`
                        }
                        alt="favicon"
                        boxSize="24px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`;
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <HStack justify="space-between">
                        <HStack spacing={2}>
                          <Text
                            fontSize="sm"
                            fontWeight="700"
                            color="text.primary"
                            noOfLines={1}
                          >
                            {new URL(request.origin).hostname}
                          </Text>
                          <Badge
                            fontSize="xs"
                            bg="bauhaus.blue"
                            color="white"
                            border="2px solid"
                            borderColor="bauhaus.black"
                            px={1.5}
                          >
                            TX
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                          {formatTimestamp(request.timestamp)}
                        </Text>
                      </HStack>
                      <HStack spacing={2} mt={1}>
                        <Badge
                          fontSize="xs"
                          bg={config.bg}
                          color={config.text}
                          border="2px solid"
                          borderColor="bauhaus.black"
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
                        <Text fontSize="xs" color="text.tertiary" fontFamily="mono" fontWeight="500">
                          {request.tx.to.slice(0, 6)}...{request.tx.to.slice(-4)}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>
                  <Box bg="bauhaus.black" p={1}>
                    <ChevronRightIcon color="bauhaus.white" />
                  </Box>
                </HStack>
              </Box>
            );
          })}

          {/* Signature Requests */}
          {signatureRequests.map((request, index) => {
            const config = getChainConfig(request.signature.chainId);
            return (
              <Box
                key={request.id}
                bg="bauhaus.white"
                border="3px solid"
                borderColor="bauhaus.black"
                boxShadow="4px 4px 0px 0px #121212"
                p={3}
                cursor="pointer"
                onClick={() => onSelectSignature(request)}
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
                {/* Corner decoration - triangle for signature */}
                <Box
                  position="absolute"
                  top="-3px"
                  right="-3px"
                  w="0"
                  h="0"
                  borderLeft="6px solid transparent"
                  borderRight="6px solid transparent"
                  borderBottom="10px solid"
                  borderBottomColor="bauhaus.red"
                />

                <HStack justify="space-between">
                  <HStack spacing={3} flex={1}>
                    <Badge
                      bg="bauhaus.black"
                      color="bauhaus.white"
                      fontSize="xs"
                      minW="28px"
                      textAlign="center"
                      fontWeight="700"
                    >
                      #{txRequests.length + index + 1}
                    </Badge>
                    <Box
                      bg="bauhaus.white"
                      border="2px solid"
                      borderColor="bauhaus.black"
                      p={1}
                    >
                      <Image
                        src={
                          request.favicon ||
                          `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`
                        }
                        alt="favicon"
                        boxSize="24px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://www.google.com/s2/favicons?domain=${new URL(request.origin).hostname}&sz=32`;
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <HStack justify="space-between">
                        <HStack spacing={2}>
                          <Text
                            fontSize="sm"
                            fontWeight="700"
                            color="text.primary"
                            noOfLines={1}
                          >
                            {new URL(request.origin).hostname}
                          </Text>
                          <Badge
                            fontSize="xs"
                            bg="bauhaus.red"
                            color="white"
                            border="2px solid"
                            borderColor="bauhaus.black"
                            px={1.5}
                          >
                            SIG
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="text.tertiary" fontWeight="500">
                          {formatTimestamp(request.timestamp)}
                        </Text>
                      </HStack>
                      <HStack spacing={2} mt={1}>
                        <Badge
                          fontSize="xs"
                          bg={config.bg}
                          color={config.text}
                          border="2px solid"
                          borderColor="bauhaus.black"
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
                        <Text fontSize="xs" color="text.tertiary" fontFamily="mono" fontWeight="500">
                          {getMethodDisplayName(request.signature.method)}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>
                  <Box bg="bauhaus.black" p={1}>
                    <ChevronRightIcon color="bauhaus.white" />
                  </Box>
                </HStack>
              </Box>
            );
          })}
        </VStack>

        {totalCount === 0 && (
          <Box
            textAlign="center"
            py={8}
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
          >
            <Text color="text.secondary" fontWeight="500">No pending requests</Text>
          </Box>
        )}

        {totalCount > 0 && (
          <Button
            variant="danger"
            w="full"
            onClick={onRejectAll}
          >
            Reject All ({totalCount})
          </Button>
        )}
      </VStack>
    </Box>
  );
}

export default memo(PendingTxList);
