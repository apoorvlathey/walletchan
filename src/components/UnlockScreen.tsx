import { useState, useEffect, useRef } from "react";
import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  InputGroup,
  InputRightElement,
  IconButton,
  Image,
  Alert,
  AlertIcon,
  Tooltip,
  Icon,
  useToast,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, LockIcon, WarningTwoIcon } from "@chakra-ui/icons";

// Sidepanel icon
const SidePanelIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm12 2v14h5V5h-5zM4 5v14h10V5H4z"
    />
  </Icon>
);

interface UnlockScreenProps {
  onUnlock: () => void;
}

function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [sidePanelSupported, setSidePanelSupported] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState(false);
  const [isInSidePanel, setIsInSidePanel] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { isOpen: isResetModalOpen, onOpen: onResetModalOpen, onClose: onResetModalClose } = useDisclosure();

  useEffect(() => {
    const checkSidePanelSupport = async () => {
      return new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({ type: "isSidePanelSupported" }, (response) => {
          resolve(response?.supported || false);
        });
      });
    };

    const checkSidePanelMode = async () => {
      return new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({ type: "getSidePanelMode" }, (response) => {
          resolve(response?.enabled || false);
        });
      });
    };

    const init = async () => {
      const supported = await checkSidePanelSupport();
      setSidePanelSupported(supported);

      if (supported) {
        const mode = await checkSidePanelMode();
        setSidePanelMode(mode);
      }

      // Detect if currently in sidepanel
      setIsInSidePanel(window.innerHeight > 620);
    };

    init();
  }, []);

  const toggleSidePanelMode = async () => {
    const newMode = !sidePanelMode;

    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "setSidePanelMode", enabled: newMode }, () => {
        resolve();
      });
    });
    setSidePanelMode(newMode);

    if (!newMode && isInSidePanel) {
      chrome.runtime.sendMessage({ type: "openPopupWindow" }, () => {
        window.close();
      });
    } else if (newMode && !isInSidePanel) {
      toast({
        title: "Sidepanel mode enabled",
        description: "Close popup and click the extension icon to open in sidepanel",
        status: "info",
        duration: null,
        isClosable: true,
      });
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError("Password is required");
      passwordInputRef.current?.focus();
      return;
    }

    setIsUnlocking(true);
    setError("");

    chrome.runtime.sendMessage(
      { type: "unlockWallet", password },
      (result: { success: boolean; error?: string }) => {
        if (result.success) {
          onUnlock();
        } else {
          setError(result.error || "Invalid password");
          setIsUnlocking(false);
          passwordInputRef.current?.focus();
        }
      }
    );
  };

  const handleResetExtension = () => {
    setIsResetting(true);
    chrome.runtime.sendMessage({ type: "resetExtension" }, (result) => {
      setIsResetting(false);
      if (result?.success) {
        onResetModalClose();
        toast({
          title: "Extension reset",
          description: "Please set up your API key and password again",
          status: "info",
          duration: 4000,
          isClosable: true,
        });
        // Reload the extension popup to show the setup screen
        window.location.reload();
      } else {
        toast({
          title: "Reset failed",
          description: result?.error || "Failed to reset extension",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    });
  };

  return (
    <Box
      minH="100%"
      bg="bg.base"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={6}
      position="relative"
    >
      {/* Sidepanel toggle - top right */}
      {sidePanelSupported && (
        <Box position="absolute" top={3} right={3}>
          <Tooltip
            label={sidePanelMode ? "Switch to popup mode" : "Switch to sidepanel mode"}
            placement="bottom"
          >
            <IconButton
              aria-label={sidePanelMode ? "Switch to popup mode" : "Switch to sidepanel mode"}
              icon={<SidePanelIcon />}
              variant="ghost"
              size="sm"
              onClick={toggleSidePanelMode}
            />
          </Tooltip>
        </Box>
      )}

      <VStack spacing={6} w="full" maxW="280px">
        <Box
          p={4}
          bg="bg.subtle"
          borderRadius="full"
          borderWidth="1px"
          borderColor="border.default"
        >
          <LockIcon boxSize={8} color="primary.400" />
        </Box>

        <VStack spacing={1}>
          <Image src="impersonatorLogo.png" w="3rem" />
          <Text fontSize="xl" fontWeight="600" color="text.primary">
            BankrWallet
          </Text>
          <Text fontSize="sm" color="text.secondary" textAlign="center">
            Enter your password to unlock
          </Text>
        </VStack>

        <VStack spacing={3} w="full">
          <InputGroup>
            <Input
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              autoFocus
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlock();
              }}
              isDisabled={isUnlocking}
              bg="bg.subtle"
              borderColor={error ? "error.solid" : "border.default"}
              _hover={{ borderColor: error ? "error.solid" : "border.strong" }}
              _focus={{
                borderColor: error ? "error.solid" : "primary.500",
                boxShadow: `0 0 0 1px var(--chakra-colors-${error ? "error-solid" : "primary-500"})`,
              }}
            />
            <InputRightElement>
              <IconButton
                aria-label={showPassword ? "Hide password" : "Show password"}
                icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                size="sm"
                variant="ghost"
                onClick={() => setShowPassword(!showPassword)}
                color="text.secondary"
              />
            </InputRightElement>
          </InputGroup>

          {error && (
            <VStack spacing={2} w="full">
              <Alert
                status="error"
                borderRadius="md"
                fontSize="sm"
                bg="error.bg"
                borderWidth="1px"
                borderColor="error.border"
                py={2}
                w="full"
              >
                <AlertIcon color="error.solid" boxSize={4} />
                <Text color="text.primary" fontSize="sm">
                  {error}
                </Text>
              </Alert>
              <Link
                fontSize="sm"
                color="text.secondary"
                _hover={{ color: "primary.400", textDecoration: "underline" }}
                onClick={onResetModalOpen}
                cursor="pointer"
              >
                Forgot Password?
              </Link>
            </VStack>
          )}

          <Button
            variant="primary"
            w="full"
            onClick={handleUnlock}
            isLoading={isUnlocking}
            loadingText="Unlocking..."
          >
            Unlock
          </Button>
        </VStack>
      </VStack>

      {/* Reset Extension Modal */}
      <Modal isOpen={isResetModalOpen} onClose={onResetModalClose} isCentered>
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg="bg.subtle" borderWidth="1px" borderColor="border.default" mx={4}>
          <ModalHeader color="text.primary" fontSize="md" pb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <WarningTwoIcon color="warning.solid" />
              Reset Extension?
            </Box>
          </ModalHeader>
          <ModalBody>
            <VStack spacing={3} align="start">
              <Text color="text.secondary" fontSize="sm">
                This will clear all your stored data including:
              </Text>
              <Box pl={4}>
                <Text color="text.secondary" fontSize="sm">• Your encrypted API key</Text>
                <Text color="text.secondary" fontSize="sm">• Your wallet address</Text>
                <Text color="text.secondary" fontSize="sm">• Transaction history</Text>
              </Box>
              <Text color="warning.solid" fontSize="sm" fontWeight="500">
                You will need to enter your Bankr API key and set up a new password again.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" size="sm" onClick={onResetModalClose} isDisabled={isResetting}>
              Cancel
            </Button>
            <Button
              size="sm"
              bg="error.solid"
              color="white"
              _hover={{ bg: "error.solid", opacity: 0.9 }}
              onClick={handleResetExtension}
              isLoading={isResetting}
              loadingText="Resetting..."
            >
              Reset Extension
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default UnlockScreen;
