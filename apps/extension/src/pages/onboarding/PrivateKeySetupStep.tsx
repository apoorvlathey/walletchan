import { useCallback, useState } from "react";
import { Box, Button, FormControl, FormLabel, Input, Text, VStack } from "@chakra-ui/react";
import { LockIcon } from "@chakra-ui/icons";
import PrivateKeyInput from "@/components/shared/PrivateKeyInput";
import { OnboardingCanvas, OnboardingFooter, OnboardingHeader, OnboardingHint } from "./OnboardingShell";

export function PrivateKeySetupStep({
  privateKey,
  derivedAddress,
  displayName,
  error,
  onPrivateKeyChange,
  onDisplayNameChange,
  onClearError,
  onBack,
  onProgressStepClick,
  onContinue,
}: {
  privateKey: string;
  derivedAddress: string | null;
  displayName: string;
  error?: string;
  onPrivateKeyChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onClearError: () => void;
  onBack: () => void;
  onProgressStepClick: (step: number) => void;
  onContinue: () => void;
}) {
  const [generatedBackupReady, setGeneratedBackupReady] = useState(true);
  const canContinue = !!derivedAddress && generatedBackupReady;
  const guardedContinue = useCallback(() => {
    if (canContinue) onContinue();
  }, [canContinue, onContinue]);
  const handleGeneratedBackupStateChange = useCallback(
    (isGenerated: boolean, isConfirmed: boolean) => {
      setGeneratedBackupReady(!isGenerated || isConfirmed);
    },
    [],
  );

  return (
    <OnboardingCanvas
      currentStep={1}
      onStepClick={onProgressStepClick}
      header={<OnboardingHeader onBack={onBack} step={1} />}
      footer={
        <OnboardingFooter>
          <Button variant="brand" size="lg" w="full" onClick={guardedContinue} isDisabled={!canContinue}>
            Continue
          </Button>
        </OnboardingFooter>
      }
    >
      <VStack align="stretch" spacing={6}>
        <VStack align="stretch" spacing={1.5}>
          <Text as="h1" fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">
            Import private key
          </Text>
        </VStack>

        <Box
          sx={{
            "& label": { textTransform: "none", letterSpacing: "normal", fontSize: "var(--chakra-fontSizes-sm)" },
            "& button:not([aria-label])": { textTransform: "none", letterSpacing: "normal", borderWidth: "1px", boxShadow: "none" },
          }}
        >
          <PrivateKeyInput
            allowGenerate={false}
            privateKey={privateKey}
            onPrivateKeyChange={onPrivateKeyChange}
            derivedAddress={derivedAddress}
            error={error}
            onClearError={onClearError}
            onContinue={guardedContinue}
            requireGeneratedBackupConfirmation
            onGeneratedBackupStateChange={handleGeneratedBackupStateChange}
            autoFocus
          />
        </Box>

        <FormControl>
          <FormLabel fontSize="sm" color="fg.primary" fontWeight="600">
            Account name <Box as="span" color="fg.muted" fontWeight="400">(optional)</Box>
          </FormLabel>
          <Input
            value={displayName}
            placeholder="Trading wallet"
            onChange={(event) => onDisplayNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") guardedContinue();
            }}
          />
        </FormControl>

        <OnboardingHint icon={<LockIcon boxSize="18px" />}>
          <Text fontSize="sm" color="fg.secondary" lineHeight="1.5">
            <Box as="span" fontWeight="600" color="fg.primary">Keep this key private.</Box>{" "}
            Anyone with it can control your account.
          </Text>
        </OnboardingHint>
      </VStack>
    </OnboardingCanvas>
  );
}
