import { ChevronDownIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { Box, Button, Checkbox, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { getAddress } from "viem";
import type { SendRecipientSafety } from "./hooks/useSendRecipientSafety";

function ComparedAddress({ label, address, other, highlight }: {
  label: string; address: string; other: string; highlight: "error" | "success";
}) {
  const displayed = getAddress(address);
  return (
    <Box minW={0}>
      <Text fontSize="xs" color="fg.secondary" mb={1}>{label}</Text>
      <Text fontFamily="mono" fontSize="sm" lineHeight="tall" overflowWrap="anywhere"
        aria-label={`${label}: ${displayed}`}>
        {Array.from(displayed).map((character, index) => {
          const differs = character.toLowerCase() !== other[index]?.toLowerCase();
          return <Box as="span" key={index} aria-hidden="true"
            color={differs ? `status.${highlight}.emphasis` : "fg.primary"}
            textDecoration={differs ? "underline" : undefined}>{character}</Box>;
        })}
      </Text>
    </Box>
  );
}

export function RecipientSafetyNotice({ safety, address }: {
  safety: SendRecipientSafety;
  address: string;
}) {
  if (safety.status === "loading") return (
    <HStack role="status" spacing={2} color="fg.secondary">
      <Spinner size="xs" /><Text fontSize="xs">Checking saved and previous recipients…</Text>
    </HStack>
  );
  if (safety.status === "error") return (
    <Box role="alert">
      <Text fontSize="sm" color="status.warning.fg">Recipient check unavailable</Text>
      <Text fontSize="xs" color="fg.secondary">Retry the local check before continuing.</Text>
      <Button variant="secondary" size="sm" mt={2} onClick={safety.retry}>Retry check</Button>
    </Box>
  );
  const match = safety.match;
  if (!match) return null;
  return (
    <Box as="details" key={`${address}:${match.address}`} p={3} bg="surface.raised"
      borderWidth="1px" borderColor="status.warning.border" borderRadius="lg"
      sx={{ "&[open] .recipient-disclosure-icon": { transform: "rotate(180deg)" } }}>
      <Box as="summary" cursor="pointer" listStyleType="none"
        sx={{ "&::-webkit-details-marker": { display: "none" } }}
        _focusVisible={{ outline: "2px solid", outlineColor: "border.focus", outlineOffset: "2px" }}>
        <HStack spacing={2}>
          <WarningTwoIcon color="status.warning.fg" aria-hidden="true" />
          <Text fontSize="sm" fontWeight="700">Possible address poisoning</Text>
          <ChevronDownIcon className="recipient-disclosure-icon" ml="auto" aria-hidden="true" />
        </HStack>
        <Text fontSize="xs" color="fg.secondary" mt={1}>
          This address looks similar to one you've used before, and might be malicious.
        </Text>
      </Box>
      <VStack align="stretch" spacing={3} mt={3} maxH="35vh" overflowY="auto">
      <ComparedAddress label="Entered recipient" address={address} other={match.address} highlight="error" />
      <ComparedAddress label={match.source === "contact" ? `Saved contact: ${match.label || "Contact"}` : "Previously sent to"}
        address={match.address} other={address} highlight="success" />
      <Checkbox size="sm" minH="36px" isChecked={safety.acknowledged}
        sx={{ "& .chakra-checkbox__control": {
          borderColor: "border.strong",
          borderRadius: "2px",
          _checked: { bg: "status.warning.fg", borderColor: "status.warning.fg", color: "fg.inverse" },
          _focusVisible: { outline: "2px solid", outlineColor: "border.focus", outlineOffset: "2px" },
        } }}
        onChange={(event) => safety.setAcknowledged(event.target.checked)}>
        <Text fontSize="xs">I checked the full address and want to continue</Text>
      </Checkbox>
      </VStack>
    </Box>
  );
}
