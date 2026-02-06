import { useState, memo } from "react";
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
import TypedDataDisplay from "@/components/TypedDataDisplay";

interface SignatureRequestConfirmationProps {
  sigRequest: PendingSignatureRequest;
  currentIndex: number;
  totalCount: number;
  isInSidePanel: boolean;
  accountType?: "bankr" | "privateKey" | "impersonator";
  onBack: () => void;
  onCancelled: () => void;
  onCancelAll: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onConfirmed?: () => void;
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

function formatSignatureData(method: string, params: any[]): { message: string; rawData: string; typedData?: any } {
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
        typedData,
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
  totalCount,
  isInSidePanel,
  accountType = "bankr",
  onBack,
  onCancelled,
  onCancelAll,
  onNavigate,
  onConfirmed,
}: SignatureRequestConfirmationProps) {
  const toast = useBauhausToast();
  const { signature, origin, chainName, favicon } = sigRequest;
  const { message, rawData, typedData } = formatSignatureData(signature.method, signature.params);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    chrome.runtime.sendMessage(
      { type: "rejectSignatureRequest", sigId: sigRequest.id },
      () => {
        onCancelled();
      }
    );
  };

  const handleConfirm = async () => {
    if (accountType !== "privateKey") {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the current tab ID
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;

      // Send confirm signature request to background
      const result = await new Promise<{ success: boolean; signature?: string; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "confirmSignatureRequest",
            sigId: sigRequest.id,
            password: "", // Use cached password
            tabId,
          },
          resolve
        );
      });

      if (result.success) {
        toast({
          title: "Signed",
          description: "Message signed successfully",
          status: "success",
          duration: 2000,
        });
        onConfirmed?.();
      } else {
        toast({
          title: "Signing failed",
          description: result.error || "Failed to sign message",
          status: "error",
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sign",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
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
                isDisabled={currentIndex === 0}
                onClick={() => onNavigate("prev")}
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
                {currentIndex + 1}/{totalCount}
              </Badge>
              <IconButton
                aria-label="Next"
                icon={<ChevronRightIcon />}
                variant="ghost"
                size="xs"
                isDisabled={currentIndex + 1 === totalCount}
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
                  bg="bauhaus.black"
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
                    fallback={<Box boxSize="16px" bg="bauhaus.black" />}
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

        {/* Typed Data Display (structured + raw) */}
        {typedData ? (
          <TypedDataDisplay typedData={typedData} rawData={rawData} />
        ) : (
          <>
            {/* Message Display (personal_sign / eth_sign) */}
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
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
                    "&::-webkit-scrollbar-thumb": { background: "#121212" },
                  }}
                >
                  <Text fontSize="xs" fontFamily="mono" color="text.tertiary" wordBreak="break-all" whiteSpace="pre-wrap">
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
                  "&::-webkit-scrollbar": { width: "6px" },
                  "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
                  "&::-webkit-scrollbar-thumb": { background: "#121212" },
                }}
              >
                <Text fontSize="xs" fontFamily="mono" color="text.tertiary" wordBreak="break-all" whiteSpace="pre-wrap">
                  {rawData}
                </Text>
              </Box>
            </Box>
          </>
        )}

        {/* Warning Box - Signatures not supported (only for Bankr accounts) */}
        {accountType === "bankr" && (
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
        )}

        {/* Impersonator Info Box */}
        {accountType === "impersonator" && (
          <Box
            bg="bauhaus.yellow"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="3px 3px 0px 0px #121212"
            p={3}
          >
            <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
              Connected via Impersonated account — signing is disabled.
            </Text>
          </Box>
        )}

        {/* Action Buttons */}
        {accountType === "privateKey" ? (
          <HStack spacing={3} mt={2}>
            <Button
              variant="secondary"
              flex={1}
              onClick={handleCancel}
              isDisabled={isSubmitting}
            >
              Reject
            </Button>
            <Button
              flex={1}
              onClick={handleConfirm}
              isLoading={isSubmitting}
              loadingText="Signing..."
              bg="bauhaus.yellow"
              color="bauhaus.black"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              fontWeight="700"
              _hover={{
                bg: "bauhaus.yellow",
                transform: "translateY(-2px)",
                boxShadow: "6px 6px 0px 0px #121212",
              }}
              _active={{
                transform: "translate(2px, 2px)",
                boxShadow: "none",
              }}
            >
              Sign
            </Button>
          </HStack>
        ) : (
          <Button
            variant="danger"
            w="full"
            onClick={handleCancel}
            mt={2}
          >
            Reject
          </Button>
        )}
      </VStack>
    </Box>
  );
}

export default memo(SignatureRequestConfirmation);
