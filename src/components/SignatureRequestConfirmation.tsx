import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  IconButton,
  Code,
  Flex,
  Spacer,
  Image,
} from "@chakra-ui/react";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { ArrowBackIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { PendingSignatureRequest } from "@/chrome/pendingSignatureStorage";
import { getChainConfig } from "@/constants/chainConfig";

interface SignatureRequestConfirmationProps {
  sigRequest: PendingSignatureRequest;
  currentIndex: number;
  totalTxCount: number;
  totalSignatureCount: number;
  isInSidePanel: boolean;
  onBack: () => void;
  onCancelled: () => void;
  onCancelAll: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onNavigateToTx: () => void;
}

// Copy button component
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useBauhausToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: "Copied!",
        status: "success",
        duration: 1500,
        isClosable: true,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <IconButton
      aria-label="Copy"
      icon={copied ? <CheckIcon /> : <CopyIcon />}
      size="xs"
      variant="ghost"
      color={copied ? "bauhaus.yellow" : "text.secondary"}
      onClick={handleCopy}
      _hover={{ color: "bauhaus.blue", bg: "bg.muted" }}
    />
  );
}

function getMethodDisplayName(method: string): string {
  switch (method) {
    case "personal_sign":
      return "Personal Sign";
    case "eth_sign":
      return "Eth Sign";
    case "eth_signTypedData":
      return "Sign Typed Data";
    case "eth_signTypedData_v3":
      return "Sign Typed Data v3";
    case "eth_signTypedData_v4":
      return "Sign Typed Data v4";
    default:
      return method;
  }
}

function formatSignatureData(method: string, params: any[]): { message: string; rawData: string } {
  try {
    if (method === "personal_sign") {
      // params[0] is the message (hex or string), params[1] is the address
      const msgParam = params[0];
      let message = msgParam;

      // Try to decode hex to string
      if (typeof msgParam === "string" && msgParam.startsWith("0x")) {
        try {
          const hex = msgParam.slice(2);
          const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
          message = new TextDecoder().decode(bytes);
        } catch {
          message = msgParam;
        }
      }

      return {
        message,
        rawData: JSON.stringify(params, null, 2),
      };
    } else if (method === "eth_sign") {
      // params[0] is address, params[1] is the data hash
      return {
        message: params[1] || "",
        rawData: JSON.stringify(params, null, 2),
      };
    } else if (method.startsWith("eth_signTypedData")) {
      // params[0] is address, params[1] is the typed data
      const typedData = typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
      return {
        message: typedData.message ? JSON.stringify(typedData.message, null, 2) : "",
        rawData: JSON.stringify(typedData, null, 2),
      };
    }
  } catch (e) {
    // Fall through to default
  }

  return {
    message: "",
    rawData: JSON.stringify(params, null, 2),
  };
}

function SignatureRequestConfirmation({
  sigRequest,
  currentIndex,
  totalTxCount,
  totalSignatureCount,
  isInSidePanel,
  onBack,
  onCancelled,
  onCancelAll,
  onNavigate,
  onNavigateToTx,
}: SignatureRequestConfirmationProps) {
  const totalCount = totalTxCount + totalSignatureCount;
  // Combined index: tx requests come first, then signature requests
  const combinedIndex = totalTxCount + currentIndex;
  const { signature, origin, chainName, favicon } = sigRequest;
  const { message, rawData } = formatSignatureData(signature.method, signature.params);

  const handleCancel = () => {
    chrome.runtime.sendMessage(
      { type: "rejectSignatureRequest", sigId: sigRequest.id },
      () => {
        onCancelled();
      }
    );
  };

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={3} align="stretch">
        {/* Top row - Back button, navigation, Reject All */}
        <Flex align="center" position="relative" minH="32px">
          {/* Left - Back button */}
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
            minW="auto"
          />

          {/* Center - Navigation (absolutely positioned for true centering) */}
          {totalCount > 1 && (
            <HStack
              spacing={0}
              position="absolute"
              left="50%"
              transform="translateX(-50%)"
            >
              <IconButton
                aria-label="Previous"
                icon={<ChevronLeftIcon />}
                variant="ghost"
                size="xs"
                isDisabled={combinedIndex === 0}
                onClick={() => {
                  // If at first signature request and there are tx requests, navigate to last tx
                  if (currentIndex === 0 && totalTxCount > 0) {
                    onNavigateToTx();
                  } else {
                    onNavigate("prev");
                  }
                }}
                color="text.secondary"
                _hover={{ color: "text.primary", bg: "bg.muted" }}
                minW="auto"
                p={1}
              />
              <Badge
                bg="bauhaus.black"
                color="bauhaus.white"
                fontSize="xs"
                px={3}
                py={1}
                fontWeight="700"
              >
                {combinedIndex + 1}/{totalCount}
              </Badge>
              <IconButton
                aria-label="Next"
                icon={<ChevronRightIcon />}
                variant="ghost"
                size="xs"
                isDisabled={currentIndex === totalSignatureCount - 1}
                onClick={() => onNavigate("next")}
                color="text.secondary"
                _hover={{ color: "text.primary", bg: "bg.muted" }}
                minW="auto"
                p={1}
              />
            </HStack>
          )}

          {/* Right - Reject All */}
          <Spacer />
          {totalCount > 1 && (
            <Button
              size="xs"
              variant="ghost"
              color="bauhaus.red"
              fontWeight="700"
              _hover={{ bg: "bauhaus.red", color: "white" }}
              onClick={onCancelAll}
              px={2}
            >
              Reject All
            </Button>
          )}
        </Flex>

        {/* Title row with red background */}
        <Box
          bg="bauhaus.red"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          py={3}
          px={4}
          position="relative"
        >
          <Box
            position="absolute"
            top="-3px"
            right="-3px"
            w="0"
            h="0"
            borderLeft="6px solid transparent"
            borderRight="6px solid transparent"
            borderBottom="12px solid"
            borderBottomColor="bauhaus.yellow"
          />
          <Text fontWeight="900" fontSize="lg" color="white" textAlign="center" textTransform="uppercase" letterSpacing="wider">
            Signature Request
          </Text>
        </Box>

        {/* Request Info Card */}
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          position="relative"
        >
          {/* Corner decoration */}
          <Box
            position="absolute"
            top="-3px"
            right="-3px"
            w="10px"
            h="10px"
            bg="bauhaus.blue"
            border="2px solid"
            borderColor="bauhaus.black"
          />

          <VStack spacing={0} divider={<Box h="2px" bg="bauhaus.black" w="full" />}>
            {/* Origin */}
            <HStack w="full" p={3} justify="space-between">
              <Text fontSize="sm" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Origin
              </Text>
              <HStack spacing={2}>
                <Box
                  bg="bauhaus.white"
                  border="2px solid"
                  borderColor="bauhaus.black"
                  p={1}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Image
                    src={
                      favicon ||
                      `https://www.google.com/s2/favicons?domain=${new URL(origin).hostname}&sz=32`
                    }
                    alt="favicon"
                    boxSize="16px"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const googleFallback = `https://www.google.com/s2/favicons?domain=${new URL(origin).hostname}&sz=32`;
                      if (target.src !== googleFallback) {
                        target.src = googleFallback;
                      }
                    }}
                    fallback={<Box boxSize="16px" bg="white" />}
                  />
                </Box>
                <Text fontSize="sm" fontWeight="700" color="text.primary">
                  {new URL(origin).hostname}
                </Text>
              </HStack>
            </HStack>

            {/* Network */}
            <HStack w="full" p={3} justify="space-between">
              <Text fontSize="sm" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Network
              </Text>
              {(() => {
                const config = getChainConfig(signature.chainId);
                return (
                  <Badge
                    fontSize="sm"
                    bg={config.bg}
                    color={config.text}
                    border="2px solid"
                    borderColor="bauhaus.black"
                    fontWeight="700"
                    px={3}
                    py={1}
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                  >
                    {config.icon && (
                      <Image src={config.icon} alt={chainName} boxSize="14px" />
                    )}
                    {chainName}
                  </Badge>
                );
              })()}
            </HStack>

            {/* Method */}
            <HStack w="full" p={3} justify="space-between">
              <Text fontSize="sm" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Method
              </Text>
              <Code
                px={2}
                py={1}
                fontSize="xs"
                bg="bauhaus.white"
                color="text.primary"
                fontFamily="mono"
                border="2px solid"
                borderColor="bauhaus.black"
                fontWeight="700"
              >
                {getMethodDisplayName(signature.method)}
              </Code>
            </HStack>
          </VStack>
        </Box>

        {/* Message Display */}
        {message && (
          <Box
            bg="bauhaus.white"
            p={3}
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
          >
            <HStack mb={2} alignItems="center">
              <Text fontSize="sm" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Message
              </Text>
              <Spacer />
              <CopyButton value={message} />
            </HStack>
            <Box
              p={3}
              bg="bg.muted"
              border="2px solid"
              borderColor="bauhaus.black"
              maxH="120px"
              overflowY="auto"
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "#E0E0E0",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#121212",
                },
              }}
            >
              <Text
                fontSize="xs"
                fontFamily="mono"
                color="text.tertiary"
                wordBreak="break-all"
                whiteSpace="pre-wrap"
              >
                {message}
              </Text>
            </Box>
          </Box>
        )}

        {/* Raw Data Display */}
        <Box
          bg="bauhaus.white"
          p={3}
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
        >
          <HStack mb={2} alignItems="center">
            <Text fontSize="sm" color="text.secondary" fontWeight="700" textTransform="uppercase">
              Raw Data
            </Text>
            <Spacer />
            <CopyButton value={rawData} />
          </HStack>
          <Box
            p={3}
            bg="bg.muted"
            border="2px solid"
            borderColor="bauhaus.black"
            maxH="100px"
            overflowY="auto"
            css={{
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-track": {
                background: "#E0E0E0",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#121212",
              },
            }}
          >
            <Text
              fontSize="xs"
              fontFamily="mono"
              color="text.tertiary"
              wordBreak="break-all"
              whiteSpace="pre-wrap"
            >
              {rawData}
            </Text>
          </Box>
        </Box>

        {/* Warning Box - Signatures not supported */}
        <Box
          bg="bauhaus.yellow"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={3}
        >
          <HStack spacing={2}>
            <Box p={1} bg="bauhaus.black">
              <WarningTwoIcon color="bauhaus.yellow" boxSize={4} />
            </Box>
            <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
              Signatures are not supported in the Bankr API
            </Text>
          </HStack>
        </Box>

        {/* Reject Button */}
        <Button
          variant="danger"
          w="full"
          onClick={handleCancel}
          mt={2}
        >
          Reject
        </Button>
      </VStack>
    </Box>
  );
}

export default SignatureRequestConfirmation;
