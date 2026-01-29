import { useState } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  InputGroup,
  InputRightElement,
  IconButton,
  Alert,
  AlertIcon,
  useToast,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { saveEncryptedApiKey } from "@/chrome/crypto";

interface ApiKeySetupProps {
  onComplete: () => void;
  onCancel: () => void;
  isChangingKey?: boolean;
}

function ApiKeySetup({ onComplete, onCancel, isChangingKey = false }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    apiKey?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const toast = useToast();

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!apiKey.trim()) {
      newErrors.apiKey = "API key is required";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await saveEncryptedApiKey(apiKey.trim(), password);

      // Clear the API key cache since we're setting a new key
      await chrome.runtime.sendMessage({ type: "clearApiKeyCache" });

      toast({
        title: "API key saved",
        description: "Your API key has been encrypted and saved.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onComplete();
    } catch (error) {
      toast({
        title: "Error saving API key",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <Heading size="md">
          {isChangingKey ? "Change API Key" : "Configure Bankr API Key"}
        </Heading>

        <Text fontSize="sm" color="gray.400">
          Your API key will be encrypted with your password and stored securely.
        </Text>

        <FormControl isInvalid={!!errors.apiKey}>
          <FormLabel>Bankr API Key</FormLabel>
          <InputGroup>
            <Input
              type={showApiKey ? "text" : "password"}
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              pr="3rem"
            />
            <InputRightElement>
              <IconButton
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                icon={showApiKey ? <ViewOffIcon /> : <ViewIcon />}
                size="sm"
                variant="ghost"
                onClick={() => setShowApiKey(!showApiKey)}
              />
            </InputRightElement>
          </InputGroup>
          <FormErrorMessage>{errors.apiKey}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.password}>
          <FormLabel>Password</FormLabel>
          <InputGroup>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              pr="3rem"
            />
            <InputRightElement>
              <IconButton
                aria-label={showPassword ? "Hide password" : "Show password"}
                icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                size="sm"
                variant="ghost"
                onClick={() => setShowPassword(!showPassword)}
              />
            </InputRightElement>
          </InputGroup>
          <FormErrorMessage>{errors.password}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.confirmPassword}>
          <FormLabel>Confirm Password</FormLabel>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
        </FormControl>

        <Alert status="warning" borderRadius="md" fontSize="sm">
          <AlertIcon />
          Keep your password safe. If you forget it, you will need to reconfigure your API key.
        </Alert>

        <Box display="flex" gap={2} pt={2}>
          <Button variant="outline" flex={1} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            flex={1}
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Save
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

export default ApiKeySetup;
