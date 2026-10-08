import { CheckIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { Badge, Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { useId, useState } from "react";
import type { SafeChainSnapshot, SafeProposalRecord } from "@/chrome/safe/types";
import type { Account } from "@/chrome/types";
import { FromAccountDisplay } from "@/components/FromAccountDisplay";

/** Signature progress is presentation only; the background verifies authority. */
export function SafeProposalSigners({ proposal, snapshot, accounts, compact = false }: {
  proposal: SafeProposalRecord;
  snapshot: SafeChainSnapshot;
  accounts: readonly Account[];
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const accountByAddress = new Map(accounts.map((account) => [account.address.toLowerCase(), account]));
  const confirmed = new Set(proposal.confirmations.map((confirmation) => confirmation.ownerAddress));
  const unsupported = new Set(proposal.unsupportedConfirmations?.map((confirmation) => confirmation.ownerAddress));
  const expandable = compact && snapshot.owners.length > 2;
  const visibleOwners = compact && !expanded ? snapshot.owners.slice(0, 2) : snapshot.owners;
  const heading = <>
    <Text color="fg.primary" fontSize="xs" fontWeight="700">Signers</Text>
    <HStack spacing={1.5}>
      <Text color="fg.secondary" fontSize="xs" fontWeight="600" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {proposal.confirmations.length}/{snapshot.threshold} signed
      </Text>
      {expandable && <ChevronDownIcon boxSize={4} transform={expanded ? "rotate(180deg)" : undefined} />}
    </HStack>
  </>;

  return (
    <VStack align="stretch" spacing={1}>
      {expandable ? (
        <Button
          variant="ghost" size="sm" px={0} w="full" minH="32px" justifyContent="space-between"
          aria-expanded={expanded} aria-controls={listId}
          aria-label={expanded ? "Show two signers" : `Show all ${snapshot.owners.length} signers`}
          onClick={() => setExpanded((current) => !current)}
        >{heading}</Button>
      ) : <HStack justify="space-between" minH="24px">{heading}</HStack>}
      <VStack
        id={listId} align="stretch" spacing={0}
        maxH={compact && expanded ? "min(160px, 25dvh)" : undefined}
        overflowY={compact ? "auto" : undefined} overscrollBehavior="contain"
        role="list" aria-label="Safe signers" tabIndex={compact && expanded ? 0 : undefined}
      >
        {visibleOwners.map((owner, index) => {
          const account = accountByAddress.get(owner);
          const signed = confirmed.has(owner);
          const status = unsupported.has(owner) || snapshot.contractOwners.includes(owner)
            ? "Unsupported" : account ? "Available" : "External";
          return (
            <HStack
              key={owner} role="listitem" minH="40px" py={1} spacing={3} justify="space-between"
              borderTop={index > 0 ? "1px solid" : undefined} borderColor="border.subtle"
            >
              <Box minW={0} flex={1} overflow="hidden">
                {account ? <FromAccountDisplay chainId={proposal.chainId} address={account.address} /> : (
                  <Text fontFamily="mono" fontSize="xs">{owner.slice(0, 6)}…{owner.slice(-4)}</Text>
                )}
              </Box>
              {signed ? (
                <Badge variant="success" display="inline-flex" alignItems="center" gap={1} flexShrink={0}>
                  <CheckIcon boxSize="10px" aria-hidden="true" /> Signed
                </Badge>
              ) : <Badge variant={status === "Available" ? "warning" : undefined} flexShrink={0}>{status}</Badge>}
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
