import { useState } from "react";
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
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, LockIcon } from "@chakra-ui/icons";

interface UnlockScreenProps {
  onUnlock: () => void;
}

function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState("");

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
    >
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
