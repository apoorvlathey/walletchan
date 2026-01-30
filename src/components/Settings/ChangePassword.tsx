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
  Spacer,
  useToast,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, ArrowBackIcon, InfoIcon } from "@chakra-ui/icons";
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
        <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="tight">
          Change Password
        </Text>
        <Spacer />
      </HStack>

      <Text fontSize="sm" color="text.secondary" fontWeight="500">
        Enter your current password and choose a new one.
      </Text>

      <FormControl isInvalid={!!errors.currentPassword}>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          Current Password
        </FormLabel>
        <InputGroup>
          <Input
            type={showCurrentPassword ? "text" : "password"}
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            pr="3rem"
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
        <FormErrorMessage color="bauhaus.red" fontWeight="700">
          {errors.currentPassword}
        </FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.newPassword}>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          New Password
        </FormLabel>
        <InputGroup>
          <Input
            type={showNewPassword ? "text" : "password"}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            pr="3rem"
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
        <FormErrorMessage color="bauhaus.red" fontWeight="700">
          {errors.newPassword}
        </FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.confirmPassword}>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          Confirm New Password
        </FormLabel>
        <Input
          type={showNewPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <FormErrorMessage color="bauhaus.red" fontWeight="700">
          {errors.confirmPassword}
        </FormErrorMessage>
      </FormControl>

      <Box
        bg="bauhaus.blue"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        p={3}
      >
        <HStack spacing={2}>
          <Box p={1} bg="bauhaus.black">
            <InfoIcon color="bauhaus.blue" boxSize={4} />
          </Box>
          <Text color="white" fontSize="sm" fontWeight="700">
            You will need to unlock again after changing your password.
          </Text>
        </HStack>
      </Box>

      <Box display="flex" gap={2} pt={2}>
        <Button variant="secondary" flex={1} onClick={onCancel}>
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
