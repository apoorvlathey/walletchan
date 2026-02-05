import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputGroup,
  InputRightElement,
  IconButton,
  Radio,
  RadioGroup,
  Code,
  Icon,
} from "@chakra-ui/react";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { ViewIcon, ViewOffIcon, ArrowBackIcon, CheckIcon } from "@chakra-ui/icons";
import { isAddress } from "@ethersproject/address";
import { privateKeyToAccount } from "viem/accounts";

// Robot icon for Bankr accounts
const RobotIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"
    />
  </Icon>
);

// Key icon for Private Key accounts
const KeyIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm14 8.5l-5.5-5.5.71-.71L17.5 11l-.71-.71-2.5 2.5-2.29-2.29-.71.71.71.71-2 2V14H9v1H8v1H7v1H4v-1l7-7c-.55-.89-.95-1.89-1-3H7c0-2.76 2.24-5 5-5 2.21 0 4.05 1.43 4.71 3.42l.79.79 1.79-1.79.71.71-.71.71 1.79 1.79.71-.71-.71-.71 1.71-1.71 1.5 1.5-8 8-1.29-1.29z"
    />
  </Icon>
);

type AccountType = "bankr" | "privateKey";

interface AddAccountProps {
  onBack: () => void;
  onAccountAdded: () => void;
}

/**
 * Validates a private key format and derives address
 */
function validateAndDeriveAddress(key: string): { valid: boolean; address?: string; normalizedKey?: string; error?: string } {
  if (!key) {
    return { valid: false, error: "Private key is required" };
  }

  // Normalize: trim whitespace and auto-prefix "0x" if missing
  let normalizedKey = key.trim();
  if (!normalizedKey.startsWith("0x") && !normalizedKey.startsWith("0X")) {
    normalizedKey = `0x${normalizedKey}`;
  }
  // Ensure lowercase 0x prefix
  if (normalizedKey.startsWith("0X")) {
    normalizedKey = `0x${normalizedKey.slice(2)}`;
  }

  // Check length (0x + 64 hex chars)
  if (normalizedKey.length !== 66) {
    return { valid: false, error: "Private key must be 64 hex characters (32 bytes)" };
  }

  // Check if all characters are valid hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    return { valid: false, error: "Invalid hex characters in private key" };
  }

  // Try to derive address using viem
  try {
    const account = privateKeyToAccount(normalizedKey as `0x${string}`);
    return { valid: true, address: account.address, normalizedKey };
  } catch (e) {
    console.error("Failed to derive address from private key:", e);
    return { valid: false, error: "Invalid private key format" };
  }
}

function AddAccount({ onBack, onAccountAdded }: AddAccountProps) {
  const toast = useBauhausToast();

  const [accountType, setAccountType] = useState<AccountType>("privateKey");
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bankrAddress, setBankrAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    privateKey?: string;
    bankrAddress?: string;
  }>({});

  // Derive address when private key changes
  useEffect(() => {
    if (accountType === "privateKey" && privateKey) {
      const result = validateAndDeriveAddress(privateKey);
      if (result.valid && result.address) {
        setDerivedAddress(result.address);
        setErrors((prev) => ({ ...prev, privateKey: undefined }));
      } else {
        setDerivedAddress(null);
        // Only show error if user has entered something
        if (privateKey.length > 10) {
          setErrors((prev) => ({ ...prev, privateKey: result.error }));
        }
      }
    } else {
      setDerivedAddress(null);
    }
  }, [privateKey, accountType]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      if (accountType === "privateKey") {
        // Validate private key
        const result = validateAndDeriveAddress(privateKey);
        if (!result.valid || !result.address || !result.normalizedKey) {
          setErrors({ privateKey: result.error || "Invalid private key" });
          setIsSubmitting(false);
          return;
        }

        // Use the normalized key from validation (already has 0x prefix)
        const normalizedKey = result.normalizedKey;

        // Get cached password
        const { hasCachedPassword } = await new Promise<{ hasCachedPassword: boolean }>((resolve) => {
          chrome.runtime.sendMessage({ type: "getCachedPassword" }, resolve);
        });

        if (!hasCachedPassword) {
          toast({
            title: "Wallet locked",
            description: "Please unlock your wallet first",
            status: "error",
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }

        // Add the private key account (background will encrypt with cached password)
        const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addPrivateKeyAccount",
              privateKey: normalizedKey,
              displayName: displayName.trim() || undefined,
            },
            resolve
          );
        });

        if (!response.success) {
          setErrors({ privateKey: response.error || "Failed to add account" });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "Account added",
          description: "Private key account has been added",
          status: "success",
          duration: 2000,
        });

        onAccountAdded();
      } else {
        // Bankr account
        if (!bankrAddress.trim()) {
          setErrors({ bankrAddress: "Address is required" });
          setIsSubmitting(false);
          return;
        }

        if (!isAddress(bankrAddress.trim())) {
          setErrors({ bankrAddress: "Invalid Ethereum address" });
          setIsSubmitting(false);
          return;
        }

        // Add bankr account
        const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addBankrAccount",
              address: bankrAddress.trim(),
              displayName: displayName.trim() || undefined,
            },
            resolve
          );
        });

        if (!response.success) {
          setErrors({ bankrAddress: response.error || "Failed to add account" });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "Account added",
          description: "Bankr account has been added",
          status: "success",
          duration: 2000,
        });

        onAccountAdded();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add account",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack spacing={3}>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
          <Text fontWeight="900" fontSize="lg" color="text.primary" textTransform="uppercase" letterSpacing="wide">
            Add Account
          </Text>
        </HStack>

        {/* Account Type Selection */}
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={4}
        >
          <Text fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase" mb={3}>
            Account Type
          </Text>
          <RadioGroup value={accountType} onChange={(val) => setAccountType(val as AccountType)}>
            <VStack spacing={3} align="stretch">
              <Box
                as="label"
                p={3}
                bg={accountType === "privateKey" ? "bg.muted" : "transparent"}
                border="2px solid"
                borderColor="bauhaus.black"
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Radio value="privateKey" colorScheme="yellow" />
                  <Box
                    bg="bauhaus.yellow"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={1}
                  >
                    <KeyIcon boxSize="16px" color="bauhaus.black" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="700" color="text.primary">
                      Private Key
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      Sign transactions locally
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              <Box
                as="label"
                p={3}
                bg={accountType === "bankr" ? "bg.muted" : "transparent"}
                border="2px solid"
                borderColor="bauhaus.black"
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Radio value="bankr" colorScheme="blue" />
                  <Box
                    bg="bauhaus.blue"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={1}
                  >
                    <RobotIcon boxSize="16px" color="white" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="700" color="text.primary">
                      Bankr Wallet
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      Use Bankr API for transactions
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            </VStack>
          </RadioGroup>
        </Box>

        {/* Private Key Input */}
        {accountType === "privateKey" && (
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <FormControl isInvalid={!!errors.privateKey}>
              <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Private Key
              </FormLabel>
              <InputGroup>
                <Input
                  type={showPrivateKey ? "text" : "password"}
                  placeholder="0x..."
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  fontFamily="mono"
                  pr="3rem"
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPrivateKey ? "Hide" : "Show"}
                    icon={showPrivateKey ? <ViewOffIcon /> : <ViewIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    color="text.secondary"
                    tabIndex={-1}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage color="bauhaus.red" fontWeight="700">
                {errors.privateKey}
              </FormErrorMessage>
            </FormControl>

            {derivedAddress && (
              <Box
                mt={4}
                p={3}
                bg="bauhaus.yellow"
                border="3px solid"
                borderColor="bauhaus.black"
                boxShadow="3px 3px 0px 0px #121212"
                position="relative"
              >
                {/* Success indicator */}
                <Box
                  position="absolute"
                  top="-10px"
                  right="-10px"
                  w="20px"
                  h="20px"
                  bg="bauhaus.blue"
                  border="2px solid"
                  borderColor="bauhaus.black"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <CheckIcon boxSize="10px" color="white" />
                </Box>
                <HStack spacing={2} mb={2}>
                  <Box w="6px" h="6px" bg="bauhaus.black" />
                  <Text fontSize="xs" color="bauhaus.black" fontWeight="900" textTransform="uppercase" letterSpacing="wider">
                    Derived Address
                  </Text>
                </HStack>
                <Code
                  fontSize="10px"
                  bg="bauhaus.white"
                  color="bauhaus.black"
                  fontFamily="mono"
                  p={2}
                  border="2px solid"
                  borderColor="bauhaus.black"
                  display="block"
                  fontWeight="700"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  title={derivedAddress}
                >
                  {derivedAddress}
                </Code>
              </Box>
            )}
          </Box>
        )}

        {/* Bankr Address Input */}
        {accountType === "bankr" && (
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <FormControl isInvalid={!!errors.bankrAddress}>
              <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Bankr Wallet Address
              </FormLabel>
              <Input
                placeholder="0x..."
                value={bankrAddress}
                onChange={(e) => {
                  setBankrAddress(e.target.value);
                  if (errors.bankrAddress) setErrors({});
                }}
                fontFamily="mono"
              />
              <FormErrorMessage color="bauhaus.red" fontWeight="700">
                {errors.bankrAddress}
              </FormErrorMessage>
            </FormControl>
          </Box>
        )}

        {/* Display Name (Optional) */}
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={4}
        >
          <FormControl>
            <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
              Display Name (Optional)
            </FormLabel>
            <Input
              placeholder="My Wallet"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </FormControl>
        </Box>

        {/* Security Warning for PK */}
        {accountType === "privateKey" && (
          <Box
            bg="bauhaus.yellow"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={3}
          >
            <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
              Your private key will be encrypted and stored locally. Never share it with anyone.
            </Text>
          </Box>
        )}

        {/* Submit Button */}
        <Button
          variant="primary"
          w="full"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          loadingText="Adding..."
          isDisabled={
            (accountType === "privateKey" && !derivedAddress) ||
            (accountType === "bankr" && !bankrAddress.trim())
          }
        >
          Add Account
        </Button>
      </VStack>
    </Box>
  );
}

export default memo(AddAccount);
