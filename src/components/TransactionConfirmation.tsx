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
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";
import { getChainConfig } from "@/constants/chainConfig";

interface TransactionConfirmationProps {
  txRequest: PendingTxRequest;
  currentIndex: number;
  totalCount: number;
  onBack: () => void;
  onConfirmed: () => void;
  onRejected: () => void;
  onRejectAll: () => void;
  onNavigate: (direction: "prev" | "next") => void;
}

type ConfirmationState = "ready" | "submitting" | "polling" | "success" | "error";

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
  onBack,
  onConfirmed,
  onRejected,
  onRejectAll,
  onNavigate,
}: TransactionConfirmationProps) {
  const [state, setState] = useState<ConfirmationState>("ready");
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
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
      { type: "confirmTransaction", txId: txRequest.id, password: "" },
      (result: { success: boolean; txHash?: string; error?: string }) => {
        if (result.success && result.txHash) {
          setTxHash(result.txHash);
          setState("success");
          // Notify parent after short delay to show success state
          setTimeout(() => {
            onConfirmed();
          }, 1500);
        } else {
          setError(result.error || "Transaction failed");
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

  const handleCancel = () => {
    chrome.runtime.sendMessage(
      { type: "cancelTransaction", txId: txRequest.id },
      (result: { success: boolean; error?: string }) => {
        if (result.success) {
          setError("Transaction cancelled");
          setState("ready");
        }
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

  if (state === "success") {
    const isActualTxHash = txHash.startsWith("0x") && txHash.length === 66;

    return (
      <Box p={4} bg="bg.base" minH="100%">
        <VStack spacing={4}>
          <Alert
            status="success"
            borderRadius="md"
            bg="success.bg"
            borderWidth="1px"
            borderColor="success.border"
          >
            <AlertIcon color="success.solid" />
            <Text color="text.primary">Transaction completed!</Text>
          </Alert>
          <Box w="full">
            <Flex mb={1} alignItems="center">
              <Text fontSize="sm" color="text.secondary">
                {isActualTxHash ? "Transaction Hash:" : "Response:"}
              </Text>
              <Spacer />
              <CopyButton value={txHash} />
            </Flex>
            <Code
              p={2}
              borderRadius="md"
              fontSize="xs"
              wordBreak="break-all"
              bg="bg.muted"
              color="text.primary"
              fontFamily="mono"
              display="block"
              w="full"
            >
              {txHash}
            </Code>
          </Box>
        </VStack>
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
        {(state === "submitting" || state === "polling") && (
          <VStack py={2} spacing={2}>
            <HStack justify="center">
              <Spinner size="sm" color="primary.500" />
              <Text fontSize="sm" color="text.secondary">
                {state === "submitting"
                  ? "Submitting transaction..."
                  : "Waiting for confirmation..."}
              </Text>
            </HStack>
            <Button
              size="sm"
              variant="outline"
              borderColor="error.solid"
              color="error.solid"
              _hover={{ bg: "error.bg" }}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </VStack>
        )}

        {/* Action Buttons */}
        {state !== "submitting" && state !== "polling" && state !== "success" && (
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
