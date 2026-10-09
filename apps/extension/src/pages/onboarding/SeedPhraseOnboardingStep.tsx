import { Box, Flex } from "@chakra-ui/react";
import SeedPhraseSetup from "@/components/SeedPhraseSetup";
import { OnboardingFrame } from "./OnboardingShell";

export function SeedPhraseOnboardingStep({
  onBack,
  onProgressStepClick,
  onCollect,
}: {
  onBack: () => void;
  onProgressStepClick: (step: number) => void;
  onCollect: (
    mnemonic: string,
    indices: number[],
    groupName?: string,
    accountDisplayName?: string,
  ) => void;
}) {
  return (
    <OnboardingFrame currentStep={1} onStepClick={onProgressStepClick}>
      <Flex flex="1" minH={0} overflowY="auto" justify="center">
        <Box
          w="full"
          maxW="600px"
          px={{ base: 5, sm: 7 }}
          pt={5}
          pb={6}
          position="relative"
        >
          <Box>
            <SeedPhraseSetup
              initialMode="import"
              onBack={onBack}
              onComplete={() => {}}
              onCollect={onCollect}
            />
          </Box>
        </Box>
      </Flex>
    </OnboardingFrame>
  );
}
