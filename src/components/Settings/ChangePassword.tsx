import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
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
  Spacer,
  useToast,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, ArrowBackIcon } from "@chakra-ui/icons";
import { loadDecryptedApiKey, saveEncryptedApiKey } from "@/chrome/crypto";

interface ChangePasswordProps {
  onComplete: () => void;
  onCancel: () => void;
}

function ChangePassword({ onComplete, onCancel }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const toast = useToast();

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (newPassword === currentPassword && newPassword) {
      newErrors.newPassword = "New password must be different";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Verify current password by trying to decrypt
      const apiKey = await loadDecryptedApiKey(currentPassword);
      if (!apiKey) {
        setErrors({ currentPassword: "Invalid password" });
        setIsSubmitting(false);
        return;
      }

      // Re-encrypt with new password
      await saveEncryptedApiKey(apiKey, newPassword);

      // Clear the API key cache since password changed
      await chrome.runtime.sendMessage({ type: "clearApiKeyCache" });

      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onComplete();
    } catch (error) {
      toast({
        title: "Error changing password",
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
    <VStack spacing={4} align="stretch">
      {/* Header */}
      <HStack>
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          size="sm"
          onClick={onCancel}
        />
        <Heading size="sm" color="text.primary">
          Change Password
        </Heading>
        <Spacer />
      </HStack>

      <Text fontSize="sm" color="text.secondary">
        Enter your current password and choose a new one.
      </Text>

      <FormControl isInvalid={!!errors.currentPassword}>
        <FormLabel color="text.secondary">Current Password</FormLabel>
        <InputGroup>
          <Input
            type={showCurrentPassword ? "text" : "password"}
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            pr="3rem"
            bg="bg.subtle"
            borderColor="border.default"
            _hover={{ borderColor: "border.strong" }}
            _focus={{
              borderColor: "primary.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
            }}
          />
          <InputRightElement>
            <IconButton
              aria-label={showCurrentPassword ? "Hide" : "Show"}
              icon={showCurrentPassword ? <ViewOffIcon /> : <ViewIcon />}
              size="sm"
              variant="ghost"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              color="text.secondary"
            />
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage color="error.solid">
          {errors.currentPassword}
        </FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.newPassword}>
        <FormLabel color="text.secondary">New Password</FormLabel>
        <InputGroup>
          <Input
            type={showNewPassword ? "text" : "password"}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            pr="3rem"
            bg="bg.subtle"
            borderColor="border.default"
            _hover={{ borderColor: "border.strong" }}
            _focus={{
              borderColor: "primary.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
            }}
          />
          <InputRightElement>
            <IconButton
              aria-label={showNewPassword ? "Hide" : "Show"}
              icon={showNewPassword ? <ViewOffIcon /> : <ViewIcon />}
              size="sm"
              variant="ghost"
              onClick={() => setShowNewPassword(!showNewPassword)}
              color="text.secondary"
            />
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage color="error.solid">
          {errors.newPassword}
        </FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.confirmPassword}>
        <FormLabel color="text.secondary">Confirm New Password</FormLabel>
        <Input
          type={showNewPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          bg="bg.subtle"
          borderColor="border.default"
          _hover={{ borderColor: "border.strong" }}
          _focus={{
            borderColor: "primary.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
          }}
        />
        <FormErrorMessage color="error.solid">
          {errors.confirmPassword}
        </FormErrorMessage>
      </FormControl>

      <Alert
        status="info"
        borderRadius="md"
        fontSize="sm"
        bg="info.bg"
        borderWidth="1px"
        borderColor="info.border"
      >
        <AlertIcon color="info.solid" />
        <Text color="text.primary">
          You will need to unlock again after changing your password.
        </Text>
      </Alert>

      <Box display="flex" gap={2} pt={2}>
        <Button variant="outline" flex={1} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          flex={1}
          onClick={handleSubmit}
          isLoading={isSubmitting}
        >
          Change Password
        </Button>
      </Box>
    </VStack>
  );
}

export default ChangePassword;
