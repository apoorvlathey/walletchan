import { useState, useEffect } from "react";
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
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, LockIcon } from "@chakra-ui/icons";

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
        }
      }
    );
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
            <Alert
              status="error"
              borderRadius="md"
              fontSize="sm"
              bg="error.bg"
              borderWidth="1px"
              borderColor="error.border"
              py={2}
            >
              <AlertIcon color="error.solid" boxSize={4} />
              <Text color="text.primary" fontSize="sm">
                {error}
              </Text>
            </Alert>
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
    </Box>
  );
}

export default UnlockScreen;
