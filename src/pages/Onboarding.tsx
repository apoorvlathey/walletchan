import { useState, useEffect } from "react";
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
  Image,
  Link,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  ViewIcon,
  ViewOffIcon,
  ArrowBackIcon,
  CheckIcon,
} from "@chakra-ui/icons";
import { saveEncryptedApiKey, hasEncryptedApiKey } from "@/chrome/crypto";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { isAddress } from "@ethersproject/address";
import { DEFAULT_NETWORKS } from "@/constants/networks";

type OnboardingStep = "welcome" | "apiKey" | "address" | "password" | "success";

interface OnboardingProps {
  onComplete: () => void;
}

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const colors = ["bauhaus.red", "bauhaus.blue", "bauhaus.yellow"];
  return (
    <VStack spacing={2}>
      <HStack spacing={3}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <Box
            key={index}
            w="12px"
            h="12px"
            bg={index <= currentStep ? colors[index] : "bauhaus.white"}
            border="2px solid"
            borderColor="bauhaus.black"
            transform={index === currentStep ? "rotate(45deg)" : "none"}
            transition="all 0.2s"
          />
        ))}
      </HStack>
      <Text fontSize="xs" color="text.tertiary" fontWeight="700" textTransform="uppercase">
        Step {currentStep + 1} of {totalSteps}
      </Text>
    </VStack>
  );
}

// Success checkmark animation
const scaleIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

// Floating arrow bounce animation
const bounceArrow = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;


function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [errors, setErrors] = useState<{
    apiKey?: string;
    walletAddress?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Check if extension is already configured on mount
  // If so, skip directly to success screen (don't expose any sensitive data)
  useEffect(() => {
    const checkExistingSetup = async () => {
      const hasApiKey = await hasEncryptedApiKey();
      if (hasApiKey) {
        // Extension already configured - show success screen only
        setStep("success");
      }
      setIsCheckingSetup(false);
    };
    checkExistingSetup();
  }, []);

  const resolveAddress = async (input: string): Promise<string | null> => {
    if (isAddress(input)) {
      return input;
    }

    try {
      // Use the configured Ethereum RPC URL for ENS resolution
      const mainnetProvider = new StaticJsonRpcProvider(
        DEFAULT_NETWORKS.Ethereum.rpcUrl,
      );
      const resolved = await mainnetProvider.resolveName(input);
      return resolved;
    } catch {
      return null;
    }
  };

  const validateApiKey = (): boolean => {
    if (!apiKey.trim()) {
      setErrors({ apiKey: "API key is required" });
      return false;
    }
    setErrors({});
    return true;
  };

  const validateAddress = async (): Promise<boolean> => {
    if (!walletAddress.trim()) {
      setErrors({ walletAddress: "Wallet address is required" });
      return false;
    }

    setIsResolvingAddress(true);
    const resolved = await resolveAddress(walletAddress.trim());
    setIsResolvingAddress(false);

    if (!resolved) {
      setErrors({ walletAddress: "Invalid address or ENS name" });
      return false;
    }

    setErrors({});
    return true;
  };

  const validatePassword = (): boolean => {
    const newErrors: typeof errors = {};

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    switch (step) {
      case "apiKey":
        if (validateApiKey()) {
          setStep("address");
        }
        break;
      case "address":
        if (await validateAddress()) {
          setStep("password");
        }
        break;
      case "password":
        if (validatePassword()) {
          await handleSubmit();
        }
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "apiKey":
        setStep("welcome");
        break;
      case "address":
        setStep("apiKey");
        break;
      case "password":
        setStep("address");
        break;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Resolve address (in case it's ENS)
      const resolvedAddress = await resolveAddress(walletAddress.trim());
      if (!resolvedAddress) {
        setErrors({ walletAddress: "Invalid address or ENS name" });
        setIsSubmitting(false);
        return;
      }

      // Save encrypted API key
      await saveEncryptedApiKey(apiKey.trim(), password);

      // Unlock wallet to cache credentials
      await chrome.runtime.sendMessage({ type: "unlockWallet", password });

      // Save wallet address and default network
      await chrome.storage.sync.set({
        address: resolvedAddress,
        displayAddress: walletAddress.trim(),
        chainName: "Base",
      });

      // Show success step
      setStep("success");

      // Notify background that onboarding is complete (but don't close tab)
      chrome.runtime.sendMessage({ type: "onboardingComplete" });
    } catch (error) {
      setErrors({
        password:
          error instanceof Error
            ? error.message
            : "Failed to save configuration",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepNumber = (): number => {
    switch (step) {
      case "apiKey":
        return 0;
      case "address":
        return 1;
      case "password":
        return 2;
      default:
        return 0;
    }
  };

  // Show loading while checking if already set up
  if (isCheckingSetup) {
    return (
      <Box
        minH="100vh"
        bg="bg.base"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="text.secondary" fontWeight="700" textTransform="uppercase" letterSpacing="wider">
          Loading...
        </Text>
      </Box>
    );
  }

  // Welcome Step
  if (step === "welcome") {
    return (
      <Box
        minH="100vh"
        bg="bg.base"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={8}
        position="relative"
      >
        {/* Geometric decorations */}
        <Box
          position="absolute"
          top={8}
          left={8}
          w="20px"
          h="20px"
          bg="bauhaus.red"
          border="3px solid"
          borderColor="bauhaus.black"
        />
        <Box
          position="absolute"
          top={8}
          right={8}
          w="20px"
          h="20px"
          bg="bauhaus.blue"
          border="3px solid"
          borderColor="bauhaus.black"
          borderRadius="full"
        />
        <Box
          position="absolute"
          bottom={20}
          left={8}
          w="0"
          h="0"
          borderLeft="10px solid transparent"
          borderRight="10px solid transparent"
          borderBottom="20px solid"
          borderBottomColor="bauhaus.yellow"
        />

        <VStack spacing={8} maxW="400px" textAlign="center">
          <Box
            bg="bauhaus.yellow"
            border="4px solid"
            borderColor="bauhaus.black"
            boxShadow="6px 6px 0px 0px #121212"
            p={4}
          >
            <Image src="/impersonatorLogo.png" w="60px" />
          </Box>

          <VStack spacing={3}>
            <Text fontSize="2xl" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wider">
              Welcome to Bankr Wallet
            </Text>
            <Text fontSize="md" color="text.secondary" lineHeight="tall" fontWeight="500">
              Bring your Bankr Wallet out of the terminal and use it with ALL
              the dApps like a regular wallet!
            </Text>
          </VStack>

          <Button
            variant="primary"
            size="lg"
            w="full"
            maxW="280px"
            onClick={() => setStep("apiKey")}
          >
            Get Started
          </Button>
        </VStack>

        {/* Footer */}
        <HStack
          spacing={1}
          justify="center"
          position="absolute"
          bottom={6}
          left={0}
          right={0}
        >
          <Text fontSize="sm" color="text.tertiary" fontWeight="500">
            Built by
          </Text>
          <Link
            display="flex"
            alignItems="center"
            gap={1}
            color="bauhaus.blue"
            fontWeight="700"
            _hover={{ color: "bauhaus.red" }}
            href="https://x.com/apoorveth"
            isExternal
          >
            <Box
              as="svg"
              viewBox="0 0 24 24"
              w="14px"
              h="14px"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </Box>
            <Text fontSize="sm" textDecor="underline">
              @apoorveth
            </Text>
          </Link>
        </HStack>
      </Box>
    );
  }

  // Success Step
  if (step === "success") {
    return (
      <Box
        minH="100vh"
        bg="bg.base"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={8}
        position="relative"
      >
        {/* Geometric decorations */}
        <Box
          position="absolute"
          top={8}
          left={8}
          w="16px"
          h="16px"
          bg="bauhaus.red"
          border="2px solid"
          borderColor="bauhaus.black"
        />
        <Box
          position="absolute"
          top={8}
          right={8}
          w="16px"
          h="16px"
          bg="bauhaus.blue"
          border="2px solid"
          borderColor="bauhaus.black"
          borderRadius="full"
        />

        {/* Floating arrow pointing to extension area */}
        <Box
          position="fixed"
          top="20px"
          right="60px"
          display="flex"
          flexDirection="column"
          alignItems="center"
          css={{
            animation: `${bounceArrow} 1.5s ease-in-out infinite`,
          }}
        >
          <Box
            as="svg"
            viewBox="0 0 24 24"
            w="40px"
            h="40px"
            fill="none"
            stroke="var(--chakra-colors-bauhaus-blue)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="rotate(-45deg)"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </Box>
          <HStack
            mt={2}
            spacing={2}
            bg="bauhaus.yellow"
            px={3}
            py={2}
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="3px 3px 0px 0px #121212"
          >
            <Image src="/impersonatorLogo.png" w="20px" h="20px" />
            <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
              BankrWallet
            </Text>
          </HStack>
          <Text
            fontSize="xs"
            color="bauhaus.blue"
            fontWeight="700"
            mt={1}
            textAlign="center"
            textTransform="uppercase"
          >
            Pin & click the extension
          </Text>
        </Box>

        <VStack spacing={6} textAlign="center">
          <Box
            w="80px"
            h="80px"
            bg="bauhaus.yellow"
            border="4px solid"
            borderColor="bauhaus.black"
            boxShadow="6px 6px 0px 0px #121212"
            display="flex"
            alignItems="center"
            justifyContent="center"
            css={{
              animation: `${scaleIn} 0.5s ease-out`,
            }}
          >
            <CheckIcon boxSize="40px" color="bauhaus.black" />
          </Box>

          <VStack spacing={2}>
            <Text fontSize="xl" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wider">
              You're all set!
            </Text>
            <Text fontSize="sm" color="text.secondary" maxW="300px" fontWeight="500">
              Pin the Bankr Wallet extension to your browser toolbar, then click
              on it to start using your wallet.
            </Text>
          </VStack>
        </VStack>

        {/* Footer */}
        <HStack
          spacing={1}
          justify="center"
          position="absolute"
          bottom={6}
          left={0}
          right={0}
        >
          <Text fontSize="sm" color="text.tertiary" fontWeight="500">
            Built by
          </Text>
          <Link
            display="flex"
            alignItems="center"
            gap={1}
            color="bauhaus.blue"
            fontWeight="700"
            _hover={{ color: "bauhaus.red" }}
            href="https://x.com/apoorveth"
            isExternal
          >
            <Box
              as="svg"
              viewBox="0 0 24 24"
              w="14px"
              h="14px"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </Box>
            <Text fontSize="sm" textDecor="underline">
              @apoorveth
            </Text>
          </Link>
        </HStack>
      </Box>
    );
  }

  // Form Steps (apiKey, address, password)
  return (
    <Box
      minH="100vh"
      bg="bg.base"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={8}
      position="relative"
    >
      {/* Geometric decorations */}
      <Box
        position="absolute"
        top={8}
        left={8}
        w="12px"
        h="12px"
        bg="bauhaus.red"
        border="2px solid"
        borderColor="bauhaus.black"
      />
      <Box
        position="absolute"
        top={8}
        right={8}
        w="12px"
        h="12px"
        bg="bauhaus.blue"
        border="2px solid"
        borderColor="bauhaus.black"
        borderRadius="full"
      />

      <VStack spacing={6} w="full" maxW="400px">
        {/* Header with back button */}
        <HStack w="full" justify="space-between" align="center">
          <IconButton
            aria-label="Go back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={handleBack}
          />
          <StepIndicator currentStep={getStepNumber()} totalSteps={3} />
          <Box w="32px" /> {/* Spacer for alignment */}
        </HStack>

        {/* API Key Step */}
        {step === "apiKey" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                Enter your API Key
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                Your Bankr API key is used to authenticate and execute
                transactions.
              </Text>
            </VStack>

            <Box
              w="full"
              p={6}
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
                bg="bauhaus.red"
                border="2px solid"
                borderColor="bauhaus.black"
              />

              <FormControl isInvalid={!!errors.apiKey}>
                <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                  Bankr API Key
                </FormLabel>
                <InputGroup>
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your API key"
                    value={apiKey}
                    autoFocus
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (errors.apiKey) setErrors({});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
                    pr="3rem"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      icon={showApiKey ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowApiKey(!showApiKey)}
                      color="text.secondary"
                      tabIndex={-1}
                    />
                  </InputRightElement>
                </InputGroup>
                <FormErrorMessage color="bauhaus.red" fontWeight="700">
                  {errors.apiKey}
                </FormErrorMessage>
              </FormControl>
            </Box>

            <Link
              fontSize="sm"
              color="bauhaus.blue"
              fontWeight="700"
              href="https://bankr.bot/api"
              isExternal
              _hover={{ color: "bauhaus.red", textDecoration: "underline" }}
            >
              Don't have an API key? Get one from bankr.bot
            </Link>

            <Button variant="primary" w="full" onClick={handleContinue}>
              Continue
            </Button>
          </VStack>
        )}

        {/* Address Step */}
        {step === "address" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                Enter your Bankr Wallet Address
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                This is the wallet address linked to your Bankr account.
              </Text>
            </VStack>

            <Box
              w="full"
              p={6}
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
                borderRadius="full"
              />

              <FormControl isInvalid={!!errors.walletAddress}>
                <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                  Wallet Address
                </FormLabel>
                <Input
                  placeholder="0x... or ENS name (e.g., vitalik.eth)"
                  value={walletAddress}
                  autoFocus
                  onChange={(e) => {
                    setWalletAddress(e.target.value);
                    if (errors.walletAddress) setErrors({});
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContinue();
                  }}
                />
                <FormErrorMessage color="bauhaus.red" fontWeight="700">
                  {errors.walletAddress}
                </FormErrorMessage>
              </FormControl>
            </Box>

            <Link
              fontSize="sm"
              color="bauhaus.blue"
              fontWeight="700"
              href="https://bankr.bot/terminal"
              isExternal
              _hover={{ color: "bauhaus.red", textDecoration: "underline" }}
            >
              Find your wallet address at bankr.bot/terminal
            </Link>

            <Button
              variant="primary"
              w="full"
              onClick={handleContinue}
              isLoading={isResolvingAddress}
              loadingText="Resolving..."
            >
              Continue
            </Button>
          </VStack>
        )}

        {/* Password Step */}
        {step === "password" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                Create a Password
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                Your password encrypts your API key locally. You'll need it to
                unlock the wallet.
              </Text>
            </VStack>

            <Box
              w="full"
              p={6}
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
                w="0"
                h="0"
                borderLeft="6px solid transparent"
                borderRight="6px solid transparent"
                borderBottom="10px solid"
                borderBottomColor="bauhaus.yellow"
              />

              <VStack spacing={4}>
                <FormControl isInvalid={!!errors.password}>
                  <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                    Password
                  </FormLabel>
                  <InputGroup>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min. 6 characters)"
                      value={password}
                      autoFocus
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({});
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleContinue();
                      }}
                      pr="3rem"
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
                        color="text.secondary"
                        tabIndex={-1}
                      />
                    </InputRightElement>
                  </InputGroup>
                  <FormErrorMessage color="bauhaus.red" fontWeight="700">
                    {errors.password}
                  </FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.confirmPassword}>
                  <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                    Confirm Password
                  </FormLabel>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors({});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
                  />
                  <FormErrorMessage color="bauhaus.red" fontWeight="700">
                    {errors.confirmPassword}
                  </FormErrorMessage>
                </FormControl>
              </VStack>
            </Box>

            <Box
              w="full"
              p={4}
              bg="bauhaus.yellow"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
            >
              <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
                Keep your password safe. If you forget it, you'll need to reset
                the extension and reconfigure your API key.
              </Text>
            </Box>

            <Button
              variant="primary"
              w="full"
              onClick={handleContinue}
              isLoading={isSubmitting}
              loadingText="Setting up..."
            >
              Complete Setup
            </Button>
          </VStack>
        )}
      </VStack>

      {/* Footer */}
      <HStack
        spacing={1}
        justify="center"
        position="absolute"
        bottom={6}
        left={0}
        right={0}
      >
        <Text fontSize="sm" color="text.tertiary" fontWeight="500">
          Built by
        </Text>
        <Link
          display="flex"
          alignItems="center"
          gap={1}
          color="bauhaus.blue"
          fontWeight="700"
          _hover={{ color: "bauhaus.red" }}
          href="https://x.com/apoorveth"
          isExternal
        >
          <Box
            as="svg"
            viewBox="0 0 24 24"
            w="14px"
            h="14px"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </Box>
          <Text fontSize="sm" textDecor="underline">
            @apoorveth
          </Text>
        </Link>
      </HStack>
    </Box>
  );
}

export default Onboarding;
