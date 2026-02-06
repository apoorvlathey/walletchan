import { useState, useEffect, useRef } from "react";
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
  Code,
  Icon,
  Checkbox,
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
import { privateKeyToAccount } from "viem/accounts";

type OnboardingStep = "welcome" | "accountType" | "bankrSetup" | "privateKey" | "password" | "success";
type AccountTypeChoice = "bankr" | "privateKey" | "both";
type PkMode = "import" | "generate";

/**
 * Generates a cryptographically secure random private key
 */
function generatePrivateKey(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

interface OnboardingProps {
  onComplete: () => void;
}

/**
 * Detects if we're running in Arc browser using CSS variable
 * Arc browser injects --arc-palette-title CSS variable
 */
function isArcBrowser(): boolean {
  try {
    const arcPaletteTitle = getComputedStyle(document.documentElement).getPropertyValue('--arc-palette-title');
    return !!arcPaletteTitle && arcPaletteTitle.trim().length > 0;
  } catch {
    return false;
  }
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
  const [accountTypeChoice, setAccountTypeChoice] = useState<AccountTypeChoice>("bankr");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [pkMode, setPkMode] = useState<PkMode>("import");
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [pkDisplayName, setPkDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [bankrDisplayName, setBankrDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [errors, setErrors] = useState<{
    apiKey?: string;
    privateKey?: string;
    walletAddress?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const keepAlivePortRef = useRef<chrome.runtime.Port | null>(null);

  // Check if extension is already configured on mount
  // If so, skip directly to success screen (don't expose any sensitive data)
  // Also detect Arc browser early to disable sidepanel
  useEffect(() => {
    const checkExistingSetup = async () => {
      // Detect Arc browser early and set flags
      if (isArcBrowser()) {
        console.log("Arc browser detected during onboarding - disabling sidepanel");
        await chrome.storage.sync.set({ isArcBrowser: true, sidePanelVerified: false, sidePanelMode: false });
      }

      const hasApiKey = await hasEncryptedApiKey();
      if (hasApiKey) {
        // Extension already configured - show success screen only
        setStep("success");
      }
      setIsCheckingSetup(false);

      // Establish keepalive connection to pause auto-lock while onboarding is open
      if (!keepAlivePortRef.current) {
        try {
          keepAlivePortRef.current = chrome.runtime.connect({ name: "ui-keepalive" });
        } catch {
          // Ignore connection errors
        }
      }
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

  const validateAndDeriveAddress = (key: string): { valid: boolean; address?: string; normalizedKey?: string; error?: string } => {
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
  };

  // Derive address when private key changes
  useEffect(() => {
    if (privateKey) {
      const result = validateAndDeriveAddress(privateKey);
      if (result.valid && result.address) {
        setDerivedAddress(result.address);
        setErrors((prev) => ({ ...prev, privateKey: undefined }));
      } else {
        setDerivedAddress(null);
        if (privateKey.length > 10) {
          setErrors((prev) => ({ ...prev, privateKey: result.error }));
        }
      }
    } else {
      setDerivedAddress(null);
    }
  }, [privateKey]);

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

  const validateBankrSetup = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};

    if (!apiKey.trim()) {
      newErrors.apiKey = "API key is required";
    }

    if (!walletAddress.trim()) {
      newErrors.walletAddress = "Wallet address is required";
    } else {
      setIsResolvingAddress(true);
      const resolved = await resolveAddress(walletAddress.trim());
      setIsResolvingAddress(false);

      if (!resolved) {
        newErrors.walletAddress = "Invalid address or ENS name";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    switch (step) {
      case "accountType":
        if (accountTypeChoice === "bankr") {
          setStep("bankrSetup");
        } else if (accountTypeChoice === "privateKey") {
          setStep("privateKey");
        } else {
          // "both" - start with bankr setup
          setStep("bankrSetup");
        }
        break;
      case "bankrSetup":
        if (await validateBankrSetup()) {
          if (accountTypeChoice === "both") {
            setStep("privateKey");
          } else {
            setStep("password");
          }
        }
        break;
      case "privateKey":
        const pkResult = validateAndDeriveAddress(privateKey);
        if (!pkResult.valid) {
          setErrors({ privateKey: pkResult.error || "Invalid private key" });
        } else {
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
      case "accountType":
        setStep("welcome");
        break;
      case "bankrSetup":
        setStep("accountType");
        break;
      case "privateKey":
        if (accountTypeChoice === "both") {
          setStep("bankrSetup");
        } else {
          setStep("accountType");
        }
        break;
      case "password":
        if (accountTypeChoice === "privateKey") {
          setStep("privateKey");
        } else if (accountTypeChoice === "both") {
          setStep("privateKey");
        } else {
          setStep("bankrSetup");
        }
        break;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      let finalAddress: string;
      let finalDisplayAddress: string;

      // Handle Private Key account setup
      if (accountTypeChoice === "privateKey" || accountTypeChoice === "both") {
        const pkResult = validateAndDeriveAddress(privateKey);
        if (!pkResult.valid || !pkResult.address || !pkResult.normalizedKey) {
          setErrors({ privateKey: pkResult.error || "Invalid private key" });
          setIsSubmitting(false);
          return;
        }

        // Use derived address
        finalAddress = pkResult.address;
        finalDisplayAddress = pkDisplayName.trim() || pkResult.address;

        // Use the normalized key from validation (already has 0x prefix)
        const normalizedKey = pkResult.normalizedKey;

        // For PK accounts, we need to save the private key encrypted
        // First, we need to create a "dummy" encrypted API key to establish the password
        // Or we can just save the API key if "both" is selected
        if (accountTypeChoice === "both") {
          // Save encrypted API key
          await saveEncryptedApiKey(apiKey.trim(), password);
        } else {
          // For PK-only, we still need to encrypt something to establish password
          // Save a placeholder that will be checked
          await saveEncryptedApiKey("pk-only-mode", password);
        }

        // Unlock wallet to cache credentials
        await chrome.runtime.sendMessage({ type: "unlockWallet", password });

        // Add the private key account
        const pkResponse = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addPrivateKeyAccount",
              privateKey: normalizedKey,
              displayName: pkDisplayName.trim() || undefined,
            },
            resolve
          );
        });

        if (!pkResponse.success) {
          setErrors({ privateKey: pkResponse.error || "Failed to add private key account" });
          setIsSubmitting(false);
          return;
        }
      }

      // Handle Bankr account setup
      if (accountTypeChoice === "bankr" || accountTypeChoice === "both") {
        // Resolve address (in case it's ENS)
        const resolvedAddress = await resolveAddress(walletAddress.trim());
        if (!resolvedAddress) {
          setErrors({ walletAddress: "Invalid address or ENS name" });
          setIsSubmitting(false);
          return;
        }

        // If bankr only, save encrypted API key
        if (accountTypeChoice === "bankr") {
          await saveEncryptedApiKey(apiKey.trim(), password);

          // Unlock wallet to cache credentials
          await chrome.runtime.sendMessage({ type: "unlockWallet", password });
        }

        // Add the Bankr account
        // Use explicit display name if provided, otherwise use ENS name if different from resolved address
        const bankrAccountDisplayName = bankrDisplayName.trim()
          || (walletAddress.trim() !== resolvedAddress ? walletAddress.trim() : undefined);
        const bankrResponse = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "addBankrAccount",
              address: resolvedAddress,
              displayName: bankrAccountDisplayName,
            },
            resolve
          );
        });

        if (!bankrResponse.success) {
          setErrors({ walletAddress: bankrResponse.error || "Failed to add Bankr account" });
          setIsSubmitting(false);
          return;
        }

        // Only use Bankr address as the final address if it's the only account type
        // When "both" is selected, PK account is added first and becomes active,
        // so we should keep the PK address as finalAddress
        if (accountTypeChoice === "bankr") {
          finalAddress = resolvedAddress;
          finalDisplayAddress = bankrDisplayName.trim() || walletAddress.trim();
        }
      }

      // Save wallet address and default network (use first account's address)
      await chrome.storage.sync.set({
        address: finalAddress!,
        displayAddress: finalDisplayAddress!,
        chainName: "Base",
      });

      // Enable sidepanel mode by default for non-Arc browsers
      const { isArcBrowser: storedIsArc } = await chrome.storage.sync.get(["isArcBrowser"]);
      if (!storedIsArc) {
        try {
          const response = await chrome.runtime.sendMessage({ type: "setSidePanelMode", enabled: true });
          if (response?.success) {
            console.log("Sidepanel mode enabled by default");
          }
        } catch {
          // Ignore errors - popup mode is fine as fallback
        }
      }

      // Show success step
      setStep("success");

      // Notify background that onboarding is complete
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
      case "accountType":
        return 0;
      case "bankrSetup":
        return 1;
      case "privateKey":
        return accountTypeChoice === "both" ? 2 : 1;
      case "password":
        if (accountTypeChoice === "privateKey") return 2;
        if (accountTypeChoice === "both") return 3;
        return 2;
      default:
        return 0;
    }
  };

  const getTotalSteps = (): number => {
    if (accountTypeChoice === "privateKey") return 3; // accountType, privateKey, password
    if (accountTypeChoice === "both") return 4; // accountType, bankrSetup, privateKey, password
    return 3; // accountType, bankrSetup, password
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
            <Image src="/bankrwallet-icon.png" w="60px" />
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
            onClick={() => setStep("accountType")}
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
            transform="rotate(45deg)"
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
            <Image src="/bankrwallet-icon.png" w="20px" h="20px" />
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
          <StepIndicator currentStep={getStepNumber()} totalSteps={getTotalSteps()} />
          <Box w="32px" /> {/* Spacer for alignment */}
        </HStack>

        {/* Account Type Selection Step */}
        {step === "accountType" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                Choose Account Type
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                Select how you want to use BankrWallet
              </Text>
            </VStack>

            <VStack spacing={3} w="full">
              {/* Bankr API Option (on top, default) */}
              <Box
                as="button"
                w="full"
                p={4}
                bg={accountTypeChoice === "bankr" || accountTypeChoice === "both" ? "bg.muted" : "bauhaus.white"}
                border="3px solid"
                borderColor={accountTypeChoice === "bankr" ? "bauhaus.blue" : "bauhaus.black"}
                boxShadow="4px 4px 0px 0px #121212"
                textAlign="left"
                onClick={() => setAccountTypeChoice(accountTypeChoice === "both" ? "both" : "bankr")}
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Box
                    bg="bauhaus.blue"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={2}
                  >
                    <Icon viewBox="0 0 24 24" boxSize="20px" color="white">
                      <path
                        fill="currentColor"
                        d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"
                      />
                    </Icon>
                  </Box>
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" fontWeight="900" color="text.primary" textTransform="uppercase">
                      Bankr Wallet
                    </Text>
                    <Text fontSize="xs" color="text.secondary" fontWeight="500">
                      Use Bankr API to execute transactions. AI-powered, no seed phrases.
                    </Text>
                  </VStack>
                  {accountTypeChoice === "bankr" && (
                    <Box w="12px" h="12px" bg="bauhaus.blue" border="2px solid" borderColor="bauhaus.black" borderRadius="full" />
                  )}
                </HStack>
              </Box>

              {/* Private Key Option */}
              <Box
                as="button"
                w="full"
                p={4}
                bg={accountTypeChoice === "privateKey" || accountTypeChoice === "both" ? "bg.muted" : "bauhaus.white"}
                border="3px solid"
                borderColor={accountTypeChoice === "privateKey" ? "bauhaus.yellow" : "bauhaus.black"}
                boxShadow="4px 4px 0px 0px #121212"
                textAlign="left"
                onClick={() => setAccountTypeChoice(accountTypeChoice === "both" ? "both" : "privateKey")}
                _hover={{ bg: "bg.muted" }}
              >
                <HStack spacing={3}>
                  <Box
                    bg="bauhaus.yellow"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    p={2}
                  >
                    <Icon viewBox="0 0 24 24" boxSize="20px" color="bauhaus.black">
                      <path
                        fill="currentColor"
                        d="M7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm14 8.5l-5.5-5.5.71-.71L17.5 11l-.71-.71-2.5 2.5-2.29-2.29-.71.71.71.71-2 2V14H9v1H8v1H7v1H4v-1l7-7c-.55-.89-.95-1.89-1-3H7c0-2.76 2.24-5 5-5 2.21 0 4.05 1.43 4.71 3.42l.79.79 1.79-1.79.71.71-.71.71 1.79 1.79.71-.71-.71-.71 1.71-1.71 1.5 1.5-8 8-1.29-1.29z"
                      />
                    </Icon>
                  </Box>
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" fontWeight="900" color="text.primary" textTransform="uppercase">
                      Private Key
                    </Text>
                    <Text fontSize="xs" color="text.secondary" fontWeight="500">
                      Import your private key to sign transactions locally. Full control, no API needed.
                    </Text>
                  </VStack>
                  {accountTypeChoice === "privateKey" && (
                    <Box w="12px" h="12px" bg="bauhaus.yellow" border="2px solid" borderColor="bauhaus.black" />
                  )}
                </HStack>
              </Box>
            </VStack>

            {/* Both option checkbox */}
            <Checkbox
              isChecked={accountTypeChoice === "both"}
              onChange={(e) => {
                if (e.target.checked) {
                  setAccountTypeChoice("both");
                } else {
                  setAccountTypeChoice("privateKey");
                }
              }}
              colorScheme="yellow"
              borderColor="bauhaus.black"
            >
              <Text fontSize="sm" color="text.secondary" fontWeight="700">
                Set up both account types
              </Text>
            </Checkbox>

            <Button variant="primary" w="full" onClick={handleContinue}>
              Continue
            </Button>
          </VStack>
        )}

        {/* Bankr Setup Step - API Key + Wallet Address together */}
        {step === "bankrSetup" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                Setup Bankr Wallet
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                Enter your Bankr API key and linked wallet address.
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

              <VStack spacing={4}>
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
                        if (errors.apiKey) setErrors((prev) => ({ ...prev, apiKey: undefined }));
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

                <FormControl isInvalid={!!errors.walletAddress}>
                  <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                    Wallet Address
                  </FormLabel>
                  <Input
                    placeholder="0x... or ENS name (e.g., vitalik.eth)"
                    value={walletAddress}
                    onChange={(e) => {
                      setWalletAddress(e.target.value);
                      if (errors.walletAddress) setErrors((prev) => ({ ...prev, walletAddress: undefined }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
                  />
                  <FormErrorMessage color="bauhaus.red" fontWeight="700">
                    {errors.walletAddress}
                  </FormErrorMessage>
                </FormControl>

                <FormControl>
                  <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                    Display Name (Optional)
                  </FormLabel>
                  <Input
                    placeholder="e.g., My Bankr Wallet"
                    value={bankrDisplayName}
                    onChange={(e) => setBankrDisplayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
                  />
                </FormControl>
              </VStack>
            </Box>

            <VStack spacing={2} w="full">
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
            </VStack>

            <Button
              variant="primary"
              w="full"
              onClick={handleContinue}
              isLoading={isResolvingAddress}
              loadingText="Verifying..."
            >
              Continue
            </Button>
          </VStack>
        )}

        {/* Private Key Step */}
        {step === "privateKey" && (
          <VStack spacing={6} w="full">
            <VStack spacing={2} textAlign="center">
              <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wide">
                {pkMode === "generate" ? "Generate Private Key" : "Enter your Private Key"}
              </Text>
              <Text fontSize="sm" color="text.secondary" fontWeight="500">
                Your private key will be encrypted and stored locally.
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
                bg="bauhaus.yellow"
                border="2px solid"
                borderColor="bauhaus.black"
              />

              {/* Import / Generate Toggle */}
              <HStack spacing={2} mb={4}>
                <Button
                  size="sm"
                  bg={pkMode === "import" ? "bauhaus.black" : "bauhaus.white"}
                  color={pkMode === "import" ? "bauhaus.white" : "text.primary"}
                  border="2px solid"
                  borderColor="bauhaus.black"
                  borderRadius="0"
                  fontWeight="700"
                  textTransform="uppercase"
                  fontSize="xs"
                  onClick={() => {
                    setPkMode("import");
                    setPrivateKey("");
                    setDerivedAddress(null);
                  }}
                  _hover={{ opacity: 0.9 }}
                >
                  Import Existing
                </Button>
                <Button
                  size="sm"
                  bg={pkMode === "generate" ? "bauhaus.black" : "bauhaus.white"}
                  color={pkMode === "generate" ? "bauhaus.white" : "text.primary"}
                  border="2px solid"
                  borderColor="bauhaus.black"
                  borderRadius="0"
                  fontWeight="700"
                  textTransform="uppercase"
                  fontSize="xs"
                  onClick={() => {
                    setPkMode("generate");
                    const newKey = generatePrivateKey();
                    setPrivateKey(newKey);
                    setShowPrivateKey(true);
                  }}
                  _hover={{ opacity: 0.9 }}
                >
                  Generate New
                </Button>
              </HStack>

              {pkMode === "import" ? (
              <FormControl isInvalid={!!errors.privateKey}>
                <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                  Private Key
                </FormLabel>
                <InputGroup>
                  <Input
                    type={showPrivateKey ? "text" : "password"}
                    placeholder="0x..."
                    value={privateKey}
                    autoFocus
                    fontFamily="mono"
                    onChange={(e) => {
                      setPrivateKey(e.target.value);
                      if (errors.privateKey) setErrors({});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
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
              ) : (
              <VStack spacing={3} align="stretch">
                <FormControl isInvalid={!!errors.privateKey}>
                  <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                    Generated Private Key
                  </FormLabel>
                  <Input
                    type={showPrivateKey ? "text" : "password"}
                    value={privateKey}
                    readOnly
                    fontFamily="mono"
                    fontSize="xs"
                  />
                  <FormErrorMessage color="bauhaus.red" fontWeight="700">
                    {errors.privateKey}
                  </FormErrorMessage>
                </FormControl>
                <Box p={2} bg="bauhaus.red" border="2px solid" borderColor="bauhaus.black">
                  <Text fontSize="xs" color="bauhaus.white" fontWeight="700">
                    Save this key now — it cannot be recovered later!
                  </Text>
                </Box>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="bauhaus.black"
                  borderWidth="2px"
                  borderRadius="0"
                  fontWeight="700"
                  textTransform="uppercase"
                  fontSize="xs"
                  onClick={() => {
                    const newKey = generatePrivateKey();
                    setPrivateKey(newKey);
                  }}
                >
                  Generate Another
                </Button>
              </VStack>
              )}

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
                    top="-12px"
                    right="-12px"
                    w="24px"
                    h="24px"
                    bg="bauhaus.blue"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <CheckIcon boxSize="12px" color="white" />
                  </Box>
                  <HStack spacing={2} mb={2}>
                    <Box w="8px" h="8px" bg="bauhaus.black" />
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

              <FormControl mt={4}>
                <FormLabel color="text.secondary" fontSize="xs" fontWeight="700" textTransform="uppercase">
                  Display Name (Optional)
                </FormLabel>
                <Input
                  placeholder="e.g., My Trading Wallet"
                  value={pkDisplayName}
                  onChange={(e) => setPkDisplayName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContinue();
                  }}
                />
              </FormControl>
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
                Never share your private key with anyone. It will be encrypted and stored only on this device.
              </Text>
            </Box>

            <Button
              variant="primary"
              w="full"
              onClick={handleContinue}
              isDisabled={!derivedAddress}
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
