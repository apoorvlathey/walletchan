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
  Badge,
  Divider,
} from "@chakra-ui/react";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import SeedPhraseSetup from "@/components/SeedPhraseSetup";
import { ViewIcon, ViewOffIcon, ArrowBackIcon, AddIcon } from "@chakra-ui/icons";
import { isAddress } from "@ethersproject/address";
import { validateAndDeriveAddress } from "@/utils/privateKeyUtils";
import { RobotIcon, KeyIcon, SeedIcon, EyeIcon } from "@/components/shared/AccountTypeIcons";
import PrivateKeyInput from "@/components/shared/PrivateKeyInput";

type AccountType = "bankr" | "privateKey" | "seedPhrase" | "impersonator";

interface Account {
  id: string;
  type: "bankr" | "privateKey";
  address: string;
  displayName?: string;
}

interface SeedGroup {
  id: string;
  name: string;
  accountCount: number;
}

interface AddAccountProps {
  onBack: () => void;
  onAccountAdded: () => void;
}

function AddAccount({ onBack, onAccountAdded }: AddAccountProps) {
  const toast = useBauhausToast();

  const [accountType, setAccountType] = useState<AccountType>("privateKey");
  const [privateKey, setPrivateKey] = useState("");
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bankrAddress, setBankrAddress] = useState("");
  const [bankrApiKey, setBankrApiKey] = useState("");
  const [showBankrApiKey, setShowBankrApiKey] = useState(false);
  const [impersonatorAddress, setImpersonatorAddress] = useState("");
  const [hasBankrAccount, setHasBankrAccount] = useState(false);
  const [seedGroups, setSeedGroups] = useState<SeedGroup[]>([]);
  const [showSeedSetup, setShowSeedSetup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [derivingGroupId, setDerivingGroupId] = useState<string | null>(null);
  const [deriveDisplayNames, setDeriveDisplayNames] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<{
    privateKey?: string;
    bankrAddress?: string;
    bankrApiKey?: string;
    impersonatorAddress?: string;
  }>({});

  // Check existing accounts and seed groups on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "getAccounts" }, (accounts: Account[]) => {
      const bankrExists = accounts?.some((a) => a.type === "bankr");
      setHasBankrAccount(bankrExists);
    });
    chrome.runtime.sendMessage({ type: "getSeedGroups" }, (groups: SeedGroup[]) => {
      setSeedGroups(groups || []);
    });
  }, []);

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
      } else if (accountType === "impersonator") {
        // Impersonator (view-only) account
        if (!impersonatorAddress.trim()) {
          setErrors({ impersonatorAddress: "Address is required" });
          setIsSubmitting(false);
          return;
        }

        if (!isAddress(impersonatorAddress.trim())) {
          setErrors({ impersonatorAddress: "Invalid Ethereum address" });
          setIsSubmitting(false);
          return;
        }

        const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addImpersonatorAccount",
              address: impersonatorAddress.trim(),
              displayName: displayName.trim() || undefined,
            },
            resolve
          );
        });

        if (!response.success) {
          setErrors({ impersonatorAddress: response.error || "Failed to add account" });
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "Account added",
          description: "Impersonator (view-only) account has been added",
          status: "success",
          duration: 2000,
        });

        onAccountAdded();
      } else {
        // Bankr account
        if (!bankrApiKey.trim()) {
          setErrors({ bankrApiKey: "API key is required" });
          setIsSubmitting(false);
          return;
        }

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

        // Check if wallet is unlocked (required to encrypt API key)
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

        // Add bankr account (background will save the API key)
        const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addBankrAccount",
              address: bankrAddress.trim(),
              displayName: displayName.trim() || undefined,
              apiKey: bankrApiKey.trim(),
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

  const handleDeriveNext = async (seedGroupId: string) => {
    setDerivingGroupId(seedGroupId);
    try {
      const name = deriveDisplayNames[seedGroupId]?.trim() || undefined;
      const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: "deriveSeedAccount", seedGroupId, displayName: name }, resolve);
      });

      if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to derive account",
          status: "error",
          duration: 3000,
        });
        return;
      }

      toast({
        title: "Account derived",
        description: "New address added from seed phrase",
        status: "success",
        duration: 2000,
      });
      onAccountAdded();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to derive account",
        status: "error",
        duration: 3000,
      });
    } finally {
      setDerivingGroupId(null);
    }
  };

  // Render SeedPhraseSetup when seed phrase is selected
  if (showSeedSetup) {
    return (
      <SeedPhraseSetup
        onBack={() => setShowSeedSetup(false)}
        onComplete={onAccountAdded}
      />
    );
  }

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
                bg={accountType === "seedPhrase" ? "bg.muted" : "transparent"}
                border="2px solid"
                borderColor="bauhaus.black"
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Radio value="seedPhrase" colorScheme="red" />
                  <Box
                    bg="bauhaus.red"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={1}
                  >
                    <SeedIcon boxSize="16px" color="bauhaus.white" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="700" color="text.primary">
                      Seed Phrase
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      12-word mnemonic (BIP39)
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
                cursor={hasBankrAccount ? "not-allowed" : "pointer"}
                opacity={hasBankrAccount ? 0.5 : 1}
                _hover={hasBankrAccount ? {} : { bg: "bg.muted" }}
                onClick={(e) => {
                  if (hasBankrAccount) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <HStack spacing={3}>
                  <Radio value="bankr" colorScheme="blue" isDisabled={hasBankrAccount} />
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
                    {hasBankrAccount && (
                      <Text fontSize="xs" color="bauhaus.red" fontWeight="700">
                        Bankr wallet already added
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Box>
              <Box
                as="label"
                p={3}
                bg={accountType === "impersonator" ? "bg.muted" : "transparent"}
                border="2px solid"
                borderColor="bauhaus.black"
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Radio value="impersonator" colorScheme="green" />
                  <Box
                    bg="bauhaus.green"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={1}
                  >
                    <EyeIcon boxSize="16px" color="bauhaus.black" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="700" color="text.primary">
                      Impersonator
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      View-only, no signing
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
            <PrivateKeyInput
              privateKey={privateKey}
              onPrivateKeyChange={setPrivateKey}
              derivedAddress={derivedAddress}
              error={errors.privateKey}
              onClearError={() => setErrors((prev) => ({ ...prev, privateKey: undefined }))}
            />
          </Box>
        )}

        {/* Seed Phrase: Existing Groups + Derive */}
        {accountType === "seedPhrase" && seedGroups.length > 0 && (
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <Text fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase" mb={3}>
              Existing Seed Phrases
            </Text>
            <VStack spacing={3} align="stretch">
              {seedGroups.map((group) => (
                <Box
                  key={group.id}
                  p={3}
                  border="2px solid"
                  borderColor="bauhaus.black"
                  bg="bg.muted"
                >
                  <HStack justify="space-between" align="center">
                    <HStack spacing={2}>
                      <Box
                        bg="bauhaus.red"
                        border="2px solid"
                        borderColor="bauhaus.black"
                        p={1}
                      >
                        <SeedIcon boxSize="14px" color="bauhaus.white" />
                      </Box>
                      <Text fontSize="sm" fontWeight="700" color="text.primary">
                        {group.name}
                      </Text>
                      <Badge
                        bg="bauhaus.black"
                        color="bauhaus.white"
                        fontSize="xs"
                        fontWeight="700"
                        px={2}
                        borderRadius={0}
                      >
                        {group.accountCount} {group.accountCount === 1 ? "account" : "accounts"}
                      </Badge>
                    </HStack>
                  </HStack>
                  <Input
                    mt={2}
                    size="sm"
                    placeholder={`Display Name for Account #${group.accountCount} (Optional)`}
                    value={deriveDisplayNames[group.id] || ""}
                    onChange={(e) =>
                      setDeriveDisplayNames((prev) => ({ ...prev, [group.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    mt={2}
                    w="full"
                    leftIcon={<AddIcon boxSize="10px" />}
                    onClick={() => handleDeriveNext(group.id)}
                    isLoading={derivingGroupId === group.id}
                    loadingText="Deriving..."
                    isDisabled={derivingGroupId !== null}
                  >
                    Derive Next Address
                  </Button>
                </Box>
              ))}
            </VStack>

            <HStack my={4} align="center">
              <Divider borderColor="bauhaus.black" />
              <Text fontSize="xs" color="text.secondary" fontWeight="700" whiteSpace="nowrap" px={2}>
                OR
              </Text>
              <Divider borderColor="bauhaus.black" />
            </HStack>

            <Button
              variant="outline"
              w="full"
              size="sm"
              border="2px solid"
              borderColor="bauhaus.black"
              fontWeight="700"
              onClick={() => setShowSeedSetup(true)}
            >
              Add New Seed Phrase
            </Button>
          </Box>
        )}

        {/* Impersonator Address Input */}
        {accountType === "impersonator" && (
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <FormControl isInvalid={!!errors.impersonatorAddress}>
              <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                Address to Impersonate
              </FormLabel>
              <Input
                placeholder="0x..."
                value={impersonatorAddress}
                onChange={(e) => {
                  setImpersonatorAddress(e.target.value);
                  if (errors.impersonatorAddress) setErrors((prev) => ({ ...prev, impersonatorAddress: undefined }));
                }}
                fontFamily="mono"
              />
              <FormErrorMessage color="bauhaus.red" fontWeight="700">
                {errors.impersonatorAddress}
              </FormErrorMessage>
            </FormControl>
            <Box mt={3} p={2} bg="bauhaus.yellow" border="2px solid" borderColor="bauhaus.black">
              <Text fontSize="xs" color="bauhaus.black" fontWeight="700">
                View-only mode: You can view transactions and signatures but cannot sign or send.
              </Text>
            </Box>
          </Box>
        )}

        {/* Bankr API Key and Address Input */}
        {accountType === "bankr" && (
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={4}
          >
            <VStack spacing={4} align="stretch">
              <FormControl isInvalid={!!errors.bankrApiKey}>
                <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                  Bankr API Key
                </FormLabel>
                <InputGroup>
                  <Input
                    type={showBankrApiKey ? "text" : "password"}
                    placeholder="Enter your API key"
                    value={bankrApiKey}
                    onChange={(e) => {
                      setBankrApiKey(e.target.value);
                      if (errors.bankrApiKey) setErrors((prev) => ({ ...prev, bankrApiKey: undefined }));
                    }}
                    pr="3rem"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showBankrApiKey ? "Hide API key" : "Show API key"}
                      icon={showBankrApiKey ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowBankrApiKey(!showBankrApiKey)}
                      color="text.secondary"
                      tabIndex={-1}
                    />
                  </InputRightElement>
                </InputGroup>
                <FormErrorMessage color="bauhaus.red" fontWeight="700">
                  {errors.bankrApiKey}
                </FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.bankrAddress}>
                <FormLabel fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                  Bankr Wallet Address
                </FormLabel>
                <Input
                  placeholder="0x..."
                  value={bankrAddress}
                  onChange={(e) => {
                    setBankrAddress(e.target.value);
                    if (errors.bankrAddress) setErrors((prev) => ({ ...prev, bankrAddress: undefined }));
                  }}
                  fontFamily="mono"
                />
                <FormErrorMessage color="bauhaus.red" fontWeight="700">
                  {errors.bankrAddress}
                </FormErrorMessage>
              </FormControl>
            </VStack>
          </Box>
        )}

        {/* Display Name (Optional) - not shown for seed phrase */}
        {accountType !== "seedPhrase" && (
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
        )}

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

        {/* Submit Button - hidden when seed groups exist (actions are inline above) */}
        {!(accountType === "seedPhrase" && seedGroups.length > 0) && (
          <Button
            variant="primary"
            w="full"
            onClick={accountType === "seedPhrase" ? () => setShowSeedSetup(true) : handleSubmit}
            isLoading={isSubmitting}
            loadingText="Adding..."
            isDisabled={
              (accountType === "privateKey" && !derivedAddress) ||
              (accountType === "bankr" && (!bankrAddress.trim() || !bankrApiKey.trim())) ||
              (accountType === "impersonator" && !impersonatorAddress.trim())
            }
          >
            {accountType === "seedPhrase" ? "Set Up Seed Phrase" : "Add Account"}
          </Button>
        )}
      </VStack>
    </Box>
  );
}

export default memo(AddAccount);
