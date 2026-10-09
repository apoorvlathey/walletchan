import { useEffect, useState } from "react";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import type { Account } from "@/chrome/types";
import type { SafeAccountRecord } from "@/chrome/safe/types";
import { getLinkedSafeOwners } from "@/chrome/safe/capabilities";
import { SafeIcon } from "@/components/shared/AccountTypeIcons";

export function SafeOwnerReminder({ accountId, accounts, onAddOwner }: {
  accountId: string;
  accounts: Account[];
  onAddOwner: () => void;
}) {
  const [record, setRecord] = useState<SafeAccountRecord | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setRecord(null);
    const load = () => {
      const current = ++revision;
      chrome.runtime.sendMessage({ type: "getSafeAccounts" }, (records: SafeAccountRecord[]) => {
        if (!active || current !== revision || chrome.runtime.lastError) return;
        setRecord(Array.isArray(records) ? records.find((item) => item.accountId === accountId) ?? null : null);
      });
    };
    const changed = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && changes.safeAccounts) load();
    };
    load();
    chrome.storage.onChanged.addListener(changed);
    return () => { active = false; chrome.storage.onChanged.removeListener(changed); };
  }, [accountId]);
  const snapshots = record ? Object.values(record.chains) : [];
  if (!snapshots.length || snapshots.some((snapshot) => getLinkedSafeOwners(snapshot, accounts).length > 0)) return null;
  return <Box as="button" type="button" onClick={onAddOwner} aria-label="Add a Safe owner account"
    w="full" px={3} py={2} bg="accent.highlight" color="accentFg.highlight"
    border="1px solid" borderColor="accent.highlight" borderRadius="lg" textAlign="left"
    appearance="none" cursor="pointer" fontFamily="inherit" _hover={{ opacity: 0.92 }}
    _focusVisible={{ outline: "2px solid", outlineColor: "border.focus", outlineOffset: "2px" }}>
    <HStack spacing={2}>
      <SafeIcon boxSize={6} flexShrink={0} />
      <VStack flex={1} minW={0} align="stretch" spacing={0.5}>
        <Text fontSize="sm" fontWeight="700">Add a Safe owner</Text>
        <Text fontSize="xs" opacity={0.72}>Required to approve requests</Text>
      </VStack>
      <ChevronRightIcon boxSize={4} aria-hidden="true" />
    </HStack>
  </Box>;
}
