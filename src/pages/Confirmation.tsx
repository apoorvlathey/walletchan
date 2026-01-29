import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Divider,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  InputGroup,
  InputRightElement,
  IconButton,
  Code,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { TransactionParams } from "@/chrome/bankrApi";

interface PendingTxInfo {
  tx: TransactionParams;
  origin: string;
  chainName: string;
}

type ConfirmationState =
  | "loading"
  | "ready"
  | "submitting"
  | "polling"
  | "success"
  | "error"
  | "not_found";

function Confirmation() {
  const [state, setState] = useState<ConfirmationState>("loading");
  const [txInfo, setTxInfo] = useState<PendingTxInfo | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [isApiKeyCached, setIsApiKeyCached] = useState(false);

  // Get transaction ID from URL
  const txId = new URLSearchParams(window.location.search).get("txId");

  useEffect(() => {
    if (!txId) {
      setState("not_found");
      return;
    }

    // Fetch pending transaction details
    chrome.runtime.sendMessage(
      { type: "getPendingTransaction", txId },
      (response: PendingTxInfo | null) => {
        if (response) {
          setTxInfo(response);
          setState("ready");

          // Check if API key is cached
          chrome.runtime.sendMessage(
            { type: "isApiKeyCached" },
            (cached: boolean) => {
              setIsApiKeyCached(cached);
            }
          );
        } else {
          setState("not_found");
        }
      }
    );
  }, [txId]);

  const handleConfirm = async () => {
    if (!txId) return;

    // If API key is not cached, password is required
    if (!isApiKeyCached && !password) {
      setError("Password is required");
      return;
    }

    setState("submitting");
    setError("");

    chrome.runtime.sendMessage(
      { type: "confirmTransaction", txId, password },
      (result: { success: boolean; txHash?: string; error?: string }) => {
        if (result.success && result.txHash) {
          setTxHash(result.txHash);
          setState("success");
        } else {
          setError(result.error || "Transaction failed");
          if (result.error === "Invalid password") {
            setState("ready");
          } else {
            setState("error");
          }
        }
      }
    );
  };

  const handleReject = () => {
    if (!txId) return;

    chrome.runtime.sendMessage(
      { type: "rejectTransaction", txId },
      () => {
        window.close();
      }
    );
  };

  const handleCancel = () => {
    if (!txId) return;

    chrome.runtime.sendMessage(
      { type: "cancelTransaction", txId },
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

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const truncateData = (data: string | undefined): string => {
    if (!data || data === "0x") return "None";
    if (data.length <= 20) return data;
    return `${data.slice(0, 10)}...${data.slice(-8)}`;
  };

  if (state === "loading") {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="xl" />
      </Box>
    );
  }

  if (state === "not_found") {
    return (
      <Box p={6}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Transaction not found or expired
        </Alert>
        <Button mt={4} w="full" onClick={() => window.close()}>
          Close
        </Button>
      </Box>
    );
  }

  if (state === "success") {
    const isActualTxHash = txHash.startsWith("0x") && txHash.length === 66;

    return (
      <Box p={6}>
        <VStack spacing={4}>
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            Transaction completed!
          </Alert>
          <Box w="full">
            <Text fontSize="sm" color="gray.400" mb={1}>
              {isActualTxHash ? "Transaction Hash:" : "Response:"}
            </Text>
            <Code p={2} borderRadius="md" fontSize="xs" wordBreak="break-all">
              {txHash}
            </Code>
          </Box>
          <Button colorScheme="blue" w="full" onClick={() => window.close()}>
            Close
          </Button>
        </VStack>
      </Box>
    );
  }

  if (state === "error" && !txInfo) {
    return (
      <Box p={6}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
        <Button mt={4} w="full" onClick={() => window.close()}>
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box p={4} minH="100vh">
      <VStack spacing={4} align="stretch">
        <Heading size="md" textAlign="center">
          Confirm Transaction
        </Heading>

        {txInfo && (
          <>
            {/* Origin */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={1}>
                Origin
              </Text>
              <Text fontSize="sm" fontWeight="medium" wordBreak="break-all">
                {txInfo.origin}
              </Text>
            </Box>

            {/* Network */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={1}>
                Network
              </Text>
              <Badge colorScheme="green" fontSize="sm">
                {txInfo.chainName}
              </Badge>
            </Box>

            <Divider />

            {/* Transaction Details */}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={1}>
                From
              </Text>
              <Code p={2} borderRadius="md" fontSize="xs">
                {truncateAddress(txInfo.tx.from)}
              </Code>
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.400" mb={1}>
                To
              </Text>
              <Code p={2} borderRadius="md" fontSize="xs">
                {truncateAddress(txInfo.tx.to)}
              </Code>
            </Box>

            <HStack>
              <Box flex={1}>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  Value
                </Text>
                <Text fontSize="sm" fontWeight="medium">
                  {formatValue(txInfo.tx.value)}
                </Text>
              </Box>
            </HStack>

            {txInfo.tx.data && txInfo.tx.data !== "0x" && (
              <Box>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  Data
                </Text>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  wordBreak="break-all"
                >
                  {truncateData(txInfo.tx.data)}
                </Code>
              </Box>
            )}

            <Divider />

            {/* Password Input */}
            {!isApiKeyCached && (
              <FormControl isInvalid={!!error && error === "Invalid password"}>
                <FormLabel fontSize="sm">Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirm();
                    }}
                    isDisabled={state === "submitting" || state === "polling"}
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
            )}

            {isApiKeyCached && (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                API key is cached. No password needed.
              </Alert>
            )}

            {/* Error Display */}
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {/* Status Messages */}
            {state === "submitting" && (
              <VStack py={2} spacing={2}>
                <HStack justify="center">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Submitting transaction...</Text>
                </HStack>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </VStack>
            )}

            {state === "polling" && (
              <VStack py={2} spacing={2}>
                <HStack justify="center">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Waiting for confirmation...</Text>
                </HStack>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </VStack>
            )}

            {/* Action Buttons */}
            {state !== "submitting" && state !== "polling" && (
              <HStack pt={2}>
                <Button
                  variant="outline"
                  flex={1}
                  onClick={handleReject}
                >
                  Reject
                </Button>
                <Button
                  colorScheme="blue"
                  flex={1}
                  onClick={handleConfirm}
                >
                  Confirm
                </Button>
              </HStack>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
}

export default Confirmation;
