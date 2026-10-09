import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { OnboardingCanvas, OnboardingFooter, OnboardingHeader, OnboardingHint } from "./OnboardingShell";
import {
  MAX_PASSWORD_LENGTH,
  MIN_NEW_PASSWORD_LENGTH,
} from "@/constants/securityPolicy";

type Errors = { password?: string; confirmPassword?: string };

export function PasswordStep({
  createNewWallet = false,
  password,
  confirmPassword,
  showPassword,
  errors,
  isSubmitting,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onBack,
  onProgressStepClick,
  onContinue,
}: {
  createNewWallet?: boolean;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  errors: Errors;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onBack: () => void;
  onProgressStepClick: (step: number) => void;
  onContinue: () => void;
}) {
  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onContinue();
  };

  return (
    <OnboardingCanvas
      currentStep={createNewWallet ? undefined : 2}
      onStepClick={isSubmitting ? undefined : onProgressStepClick}
      header={<OnboardingHeader onBack={isSubmitting ? undefined : onBack} step={createNewWallet ? undefined : 2} />}
      footer={
        <OnboardingFooter>
          <Button
            variant="brand"
            size="lg"
            w="full"
            onClick={onContinue}
            isLoading={isSubmitting}
            loadingText="Creating wallet…"
          >
            Create wallet
          </Button>
        </OnboardingFooter>
      }
    >
      <VStack align="stretch" spacing={6}>
        <VStack align="stretch" spacing={1.5}>
          <Text as="h1" fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">
            Create a password
          </Text>
        </VStack>

        <VStack align="stretch" spacing={5}>
          <FormControl isInvalid={!!errors.password}>
            <FormLabel fontSize="sm" color="fg.primary" fontWeight="600">Password</FormLabel>
            <InputGroup>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder={`At least ${MIN_NEW_PASSWORD_LENGTH} characters`}
                autoFocus
                autoComplete="new-password"
                maxLength={MAX_PASSWORD_LENGTH}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={submitOnEnter}
                pr="3rem"
              />
              <InputRightElement>
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                  tabIndex={-1}
                  size="sm"
                  variant="ghost"
                  onClick={onTogglePassword}
                  color="fg.secondary"
                />
              </InputRightElement>
            </InputGroup>
            <FormErrorMessage color="chart.negative">{errors.password}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={!!errors.confirmPassword}>
            <FormLabel fontSize="sm" color="fg.primary" fontWeight="600">Confirm password</FormLabel>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              placeholder="Enter the same password again"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD_LENGTH}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              onKeyDown={submitOnEnter}
            />
            <FormErrorMessage color="chart.negative">{errors.confirmPassword}</FormErrorMessage>
          </FormControl>
        </VStack>

        <OnboardingHint>
          <Text fontSize="sm" color="fg.secondary" lineHeight="1.5">
            <Box as="span" fontWeight="600" color="fg.primary">
              {createNewWallet ? "Back up your wallet after setup." : "Keep your password safe."}
            </Box>{" "}
            {createNewWallet
              ? "Until then, losing your password means losing access."
              : "If you forget it, reset the wallet and import your accounts again."}
          </Text>
        </OnboardingHint>
      </VStack>
    </OnboardingCanvas>
  );
}
