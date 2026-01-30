import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Divider,
  Badge,
  Alert,
  AlertIcon,
  IconButton,
  Code,
  Flex,
  Spacer,
  useToast,
  Image,
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon } from "@chakra-ui/icons";
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
  const toast = useToast();

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
      color={copied ? "success.solid" : "text.secondary"}
      onClick={handleCopy}
      _hover={{ color: "text.primary", bg: "bg.emphasis" }}
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
                _hover={{ color: "text.primary", bg: "bg.emphasis" }}
                minW="auto"
                p={1}
              />
              <Badge
                bg="bg.muted"
                color="text.secondary"
                fontSize="xs"
                px={2}
                py={0.5}
                borderRadius="full"
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
                _hover={{ color: "text.primary", bg: "bg.emphasis" }}
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
              color="error.solid"
              _hover={{ bg: "error.bg" }}
              onClick={onCancelAll}
              px={2}
            >
              Reject All
            </Button>
          )}
        </Flex>

        {/* Title row */}
        <Text fontWeight="600" fontSize="lg" color="text.primary" textAlign="center">
          Signature Request
        </Text>

        {/* Request Info */}
        <VStack
          spacing={0}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.default"
          divider={<Divider borderColor="border.default" />}
        >
          {/* Origin */}
          <HStack w="full" p={3} justify="space-between">
            <Text fontSize="sm" color="text.secondary">
              Origin
            </Text>
            <HStack spacing={2}>
              <Box
                bg="white"
                p="2px"
                borderRadius="md"
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
                  borderRadius="sm"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const googleFallback = `https://www.google.com/s2/favicons?domain=${new URL(origin).hostname}&sz=32`;
                    if (target.src !== googleFallback) {
                      target.src = googleFallback;
                    }
                  }}
                  fallback={<Box boxSize="16px" bg="white" borderRadius="sm" />}
                />
              </Box>
              <Text fontSize="sm" fontWeight="medium" color="text.primary">
                {new URL(origin).hostname}
              </Text>
            </HStack>
          </HStack>

          {/* Network */}
          <HStack w="full" p={3} justify="space-between">
            <Text fontSize="sm" color="text.secondary">
              Network
            </Text>
            {(() => {
              const config = getChainConfig(signature.chainId);
              return (
                <Badge
                  fontSize="sm"
                  bg={config.bg}
                  color={config.text}
                  borderWidth="1px"
                  borderColor={config.border}
                  borderRadius="full"
                  textTransform="uppercase"
                  fontWeight="600"
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
            <Text fontSize="sm" color="text.secondary">
              Method
            </Text>
            <Code
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
              bg="bg.muted"
              color="text.primary"
              fontFamily="mono"
            >
              {getMethodDisplayName(signature.method)}
            </Code>
          </HStack>
        </VStack>

        {/* Message Display */}
        {message && (
          <Box
            bg="bg.subtle"
            p={3}
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.default"
          >
            <HStack mb={2} alignItems="center">
              <Text fontSize="sm" color="text.secondary">
                Message
              </Text>
              <Spacer />
              <CopyButton value={message} />
            </HStack>
            <Box
              p={3}
              borderRadius="md"
              bg="bg.muted"
              maxH="120px"
              overflowY="auto"
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "3px",
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
          bg="bg.subtle"
          p={3}
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.default"
        >
          <HStack mb={2} alignItems="center">
            <Text fontSize="sm" color="text.secondary">
              Raw Data
            </Text>
            <Spacer />
            <CopyButton value={rawData} />
          </HStack>
          <Box
            p={3}
            borderRadius="md"
            bg="bg.muted"
            maxH="100px"
            overflowY="auto"
            css={{
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(255,255,255,0.2)",
                borderRadius: "3px",
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
        <Alert
          status="warning"
          borderRadius="md"
          bg="warning.bg"
          borderWidth="1px"
          borderColor="warning.border"
        >
          <AlertIcon color="warning.solid" />
          <Text fontSize="sm" color="text.primary">
            Signatures are not supported in the Bankr API
          </Text>
        </Alert>

        {/* Reject Button */}
        <Button
          variant="outline"
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
