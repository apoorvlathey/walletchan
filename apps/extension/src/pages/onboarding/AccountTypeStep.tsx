import { Box, Image, Text, VStack } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import { ListSurface, ListItem, ListItemContent, ListItemTitle, ListItemMedia, ListItemActions } from "@/components/ui";
import { LedgerLogo } from "@/components/Ledger/LedgerLogo";
import { EyeIcon, KeyIcon, SeedIcon, SafeIcon } from "@/components/shared/AccountTypeIcons";
import { OnboardingCanvas, OnboardingHeader } from "./OnboardingShell";
import type { AccountTypeChoice } from "./onboardingTypes";

export function AccountTypeStep({ onChoose, onBack }: {
  onChoose: (choice: AccountTypeChoice) => void;
  onBack: () => void;
}) {
  const ledgerAvailable = typeof navigator !== "undefined" && "hid" in navigator &&
    typeof chrome !== "undefined" && "offscreen" in chrome;
  const options = [
    { title: "Ledger", type: "ledger", group: "Connect", icon: <LedgerLogo variant="lettermark" w="20px" /> },
    { title: "Safe", type: "safe", group: "Connect", icon: <SafeIcon boxSize="24px" color="status.success.emphasis" /> },
    { title: "Bankr API", type: "bankr", group: "Connect", icon: <Image src="/bankr-icon.png" alt="" boxSize="32px" /> },
    { title: "Private Key", type: "privateKey", group: "Import", icon: <KeyIcon boxSize="20px" /> },
    { title: "Seed Phrase", type: "seedPhrase", group: "Import", icon: <SeedIcon boxSize="20px" /> },
    { title: "View-only", type: "viewOnly", group: "Import", icon: <EyeIcon boxSize="20px" /> },
  ] as const;
  return (
    <OnboardingCanvas morph currentStep={0} header={<OnboardingHeader onBack={onBack} step={0} />}>
      <VStack align="stretch" spacing={6}>
        <Text as="h1" fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">Import or connect</Text>
        {["Connect", "Import"].map((group) => (
          <VStack key={group} align="stretch" spacing={2}>
            <Text as="h2" fontSize="sm" fontWeight="600" color="fg.secondary">{group}</Text>
            <ListSurface>
              {options.filter((option) => option.group === group && (option.type !== "ledger" || ledgerAvailable)).map((option) => (
                <ListItem key={option.type} interactive onClick={() => onChoose(option.type)}>
                  <ListItemMedia><Box boxSize="36px" display="grid" placeItems="center" color="accent.highlight">{option.icon}</Box></ListItemMedia>
                  <ListItemContent><ListItemTitle>{option.title}</ListItemTitle></ListItemContent>
                  <ListItemActions><ChevronRightIcon color="fg.muted" boxSize={5} /></ListItemActions>
                </ListItem>
              ))}
            </ListSurface>
          </VStack>
        ))}
      </VStack>
    </OnboardingCanvas>
  );
}
