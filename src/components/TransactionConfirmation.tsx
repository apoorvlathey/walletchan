import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Divider,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  IconButton,
  Code,
  Flex,
  Spacer,
  useToast,
  Image,
  Icon,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { ArrowBackIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";
import { getChainConfig } from "@/constants/chainConfig";

// Success animation keyframes
const scaleIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

const checkmarkDraw = keyframes`
  0% { stroke-dashoffset: 50; }
  100% { stroke-dashoffset: 0; }
`;

interface TransactionConfirmationProps {
  txRequest: PendingTxRequest;
  currentIndex: number;
  totalCount: number;
  isInSidePanel: boolean;
  onBack: () => void;
  onConfirmed: () => void;
  onRejected: () => void;
  onRejectAll: () => void;
  onNavigate: (direction: "prev" | "next") => void;
}

type ConfirmationState = "ready" | "submitting" | "sent" | "error";

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

function TransactionConfirmation({
  txRequest,
  currentIndex,
  totalCount,
  isInSidePanel,
  onBack,
  onConfirmed,
  onRejected,
  onRejectAll,
  onNavigate,
}: TransactionConfirmationProps) {
  const [state, setState] = useState<ConfirmationState>("ready");
  const [error, setError] = useState<string>("");
  const [toLabels, setToLabels] = useState<string[]>([]);

  const { tx, origin, chainName, favicon } = txRequest;

  // Fetch labels for the "to" address
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await fetch(
          `https://eth.sh/api/labels/${tx.to}?chainId=${tx.chainId}`
        );
        if (response.ok) {
          const labels = await response.json();
          if (Array.isArray(labels) && labels.length > 0) {
            setToLabels(labels);
          }
        }
      } catch (err) {
        // Silently fail - labels are optional
        console.error("Failed to fetch labels:", err);
      }
    };

    fetchLabels();
  }, [tx.to, tx.chainId]);

  const handleConfirm = async () => {
    setState("submitting");
    setError("");

    chrome.runtime.sendMessage(
      { type: "confirmTransactionAsync", txId: txRequest.id, password: "" },
      (result: { success: boolean; error?: string }) => {
        if (result.success) {
          // Transaction submitted
          if (isInSidePanel) {
            // In sidepanel, navigate away immediately
            onConfirmed();
          } else {
            // In popup, show success animation then close
            setState("sent");
            setTimeout(() => {
              window.close();
            }, 1000);
          }
        } else {
          setError(result.error || "Failed to submit transaction");
          setState("error");
        }
      }
    );
  };

  const handleReject = () => {
    chrome.runtime.sendMessage(
      { type: "rejectTransaction", txId: txRequest.id },
      () => {
        onRejected();
      }
    );
  };

  const formatValue = (value: string | undefined): string => {
    if (!value || value === "0" || value === "0x0") {
      return "0 ETH";
    }
    // Convert hex to decimal and format as ETH
    const wei = BigInt(value);
    const eth = Number(wei) / 1e18;
    return `${eth.toFixed(6)} ETH`;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Success animation screen (popup mode only)
  if (state === "sent") {
    return (
      <Box
        h="100vh"
        bg="bg.base"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={8}
      >
        <Box
          w="80px"
          h="80px"
          borderRadius="full"
          bg="success.bg"
          borderWidth="3px"
          borderColor="success.solid"
          display="flex"
          alignItems="center"
          justifyContent="center"
          animation={`${scaleIn} 0.4s ease-out`}
          mb={6}
        >
          <Icon
            viewBox="0 0 24 24"
            w="40px"
            h="40px"
            color="success.solid"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 0,
                animation: `${checkmarkDraw} 0.4s ease-out 0.2s backwards`,
              }}
            />
          </Icon>
        </Box>
        <Text
          fontSize="xl"
          fontWeight="600"
          color="text.primary"
          mb={2}
        >
          Transaction Sent
        </Text>
        <Text
          fontSize="sm"
          color="text.secondary"
          textAlign="center"
        >
          Your transaction has been submitted
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={4} align="stretch">
        <Flex align="center" position="relative">
          {/* Left - Back button */}
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
            minW="auto"
          />

          {/* Center - Title and navigation */}
          <HStack
            spacing={2}
            position="absolute"
            left="50%"
            transform="translateX(-50%)"
          >
            <Text fontWeight="600" fontSize="sm" color="text.primary" whiteSpace="nowrap">
              Tx Request
            </Text>
            {totalCount > 1 && (
              <HStack spacing={0}>
                <IconButton
                  aria-label="Previous"
                  icon={<ChevronLeftIcon />}
                  variant="ghost"
                  size="xs"
                  isDisabled={currentIndex === 0}
                  onClick={() => onNavigate("prev")}
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
                  {currentIndex + 1}/{totalCount}
                </Badge>
                <IconButton
                  aria-label="Next"
                  icon={<ChevronRightIcon />}
                  variant="ghost"
                  size="xs"
                  isDisabled={currentIndex === totalCount - 1}
                  onClick={() => onNavigate("next")}
                  color="text.secondary"
                  _hover={{ color: "text.primary", bg: "bg.emphasis" }}
                  minW="auto"
                  p={1}
                />
              </HStack>
            )}
          </HStack>

          {/* Right - Reject All */}
          <Spacer />
          {totalCount > 1 && (
            <Button
              size="xs"
              variant="ghost"
              color="error.solid"
              _hover={{ bg: "error.bg" }}
              onClick={onRejectAll}
              px={2}
            >
              Reject All
            </Button>
          )}
        </Flex>

        {/* Transaction Info */}
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
                  fallback={<Box boxSize="16px" bg="bg.muted" borderRadius="sm" />}
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
              const config = getChainConfig(tx.chainId);
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

          {/* To Address */}
          <Box w="full" p={3}>
            <HStack justify="space-between" mb={toLabels.length > 0 ? 2 : 0}>
              <Text fontSize="sm" color="text.secondary">
                To
              </Text>
              <HStack spacing={1}>
                <Code
                  px={2}
                  py={1}
                  borderRadius="md"
                  fontSize="xs"
                  bg="bg.muted"
                  color="text.primary"
                  fontFamily="mono"
                >
                  {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                </Code>
                <CopyButton value={tx.to} />
              </HStack>
            </HStack>
            {toLabels.length > 0 && (
              <Flex gap={1} flexWrap="wrap" justify="flex-end">
                {toLabels.map((label, index) => (
                  <Badge
                    key={index}
                    fontSize="xs"
                    bg="bg.muted"
                    color="text.secondary"
                    borderWidth="1px"
                    borderColor="border.default"
                    borderRadius="full"
                    px={2}
                    py={0.5}
                    fontWeight="normal"
                    textTransform="none"
                  >
                    {label}
                  </Badge>
                ))}
              </Flex>
            )}
          </Box>

          {/* Value */}
          <HStack w="full" p={3} justify="space-between">
            <Text fontSize="sm" color="text.secondary">
              Value
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="text.primary">
              {formatValue(tx.value)}
            </Text>
          </HStack>
        </VStack>

        {/* Calldata */}
        {tx.data && tx.data !== "0x" && (
          <Box
            bg="bg.subtle"
            p={3}
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.default"
          >
            <HStack mb={2} alignItems="center">
              <Text fontSize="sm" color="text.secondary">
                Data
              </Text>
              <Spacer />
              <CopyButton value={tx.data} />
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
                {tx.data}
              </Text>
            </Box>
          </Box>
        )}

        {/* Error Display */}
        {error && state === "error" && (
          <Alert
            status="error"
            borderRadius="md"
            fontSize="sm"
            bg="error.bg"
            borderWidth="1px"
            borderColor="error.border"
          >
            <AlertIcon color="error.solid" />
            <Text color="text.primary">{error}</Text>
          </Alert>
        )}

        {/* Status Messages */}
        {state === "submitting" && (
          <HStack justify="center" py={2}>
            <Spinner size="sm" color="primary.500" />
            <Text fontSize="sm" color="text.secondary">
              Submitting transaction...
            </Text>
          </HStack>
        )}

        {/* Action Buttons */}
        {state !== "submitting" && (
          <HStack pt={2}>
            <Button variant="outline" flex={1} onClick={handleReject}>
              Reject
            </Button>
            <Button
              variant="primary"
              flex={1}
              onClick={handleConfirm}
              isDisabled={state === "error"}
            >
              Confirm
            </Button>
          </HStack>
        )}
      </VStack>
    </Box>
  );
}

export default TransactionConfirmation;
