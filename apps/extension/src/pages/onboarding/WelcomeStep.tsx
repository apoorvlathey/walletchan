import { Box, Button, VisuallyHidden, VStack } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import UnlockMascot from "@/components/UnlockMascot";
import { UNLOCK_SUCCESS_HOLD_MS, UNLOCK_SUCCESS_REDUCED_MOTION_HOLD_MS } from "@/app/unlockRouting";
import { playInteractionSound } from "@/sounds/soundManager";
import { OnboardingCanvas, OnboardingHeader } from "./OnboardingShell";

export function WelcomeStep({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navigationTimer.current !== null) clearTimeout(navigationTimer.current);
  }, []);

  const chooseFlow = (onContinue: () => void) => {
    if (navigationTimer.current !== null) return;
    setIsCelebrating(true);
    void playInteractionSound("unlockSuccess");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navigationTimer.current = setTimeout(
      onContinue,
      reducedMotion ? UNLOCK_SUCCESS_REDUCED_MOTION_HOLD_MS : UNLOCK_SUCCESS_HOLD_MS,
    );
  };

  return (
    <OnboardingCanvas morph header={<OnboardingHeader />}>
      <VStack align="center" justify="center" minH="calc(100dvh - 180px)" spacing={8}>
        <Box boxSize={{ base: "144px", sm: "180px" }} aria-hidden="true">
          <UnlockMascot state={isCelebrating ? "success" : "attentive"} />
        </Box>
        <VisuallyHidden as="h1">Set up your wallet</VisuallyHidden>
        <VStack w="full" spacing={3}>
          <Button variant="brand" size="lg" w="full" isDisabled={isCelebrating} onClick={() => chooseFlow(onCreate)}>Create new wallet</Button>
          <Button variant="secondary" size="lg" w="full" h="auto" minH="48px" py={3} whiteSpace="normal" isDisabled={isCelebrating} onClick={() => chooseFlow(onImport)}>
            Import or connect existing account
          </Button>
        </VStack>
      </VStack>
    </OnboardingCanvas>
  );
}
