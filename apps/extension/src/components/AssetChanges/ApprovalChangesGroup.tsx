import { InfoOutlineIcon, WarningTwoIcon } from "@chakra-ui/icons";
import {
  Box,
  HStack,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";

import type { ApprovalChange } from "@/chrome/txSimulation";
import { LabeledAddressPopover } from "@/components/shared/LabeledAddressPopover";
import { TokenContractPopover } from "@/components/shared/TokenContractPopover";
import { useTheme } from "@/theme";
import TokenLogo from "@/components/TokenLogo";
import { formatTokenAmountFromBase } from "@/lib/tokenFormatUtils";

function spenderLabel(change: ApprovalChange): string {
  return (
    change.spenderLabel ||
    change.spenderEns ||
    `${change.spender.slice(0, 6)}...${change.spender.slice(-4)}`
  );
}

function amountLabel(change: ApprovalChange): string {
  if (change.isUnlimited) return `Unlimited ${change.symbol}`;
  const raw =
    change.remainingAmount ??
    change.requestedAmount;
  try {
    return `${formatTokenAmountFromBase(raw, change.decimals, {
      thousandsSeparator: true,
    })} ${change.symbol}`;
  } catch {
    return change.symbol;
  }
}

function expirationLabel(expiration: number | null): string | null {
  if (!expiration) return null;
  try {
    const expirationDate = new Date(expiration * 1000);
    if (Number.isNaN(expirationDate.getTime())) return null;
    return `Expires ${expirationDate.toLocaleString()}`;
  } catch {
    return null;
  }
}

function ApprovalRow({
  change,
  explorerUrl,
  chainId,
}: {
  change: ApprovalChange;
  explorerUrl: string;
  chainId: number;
}) {
  const unverified = change.verification === "unverified";
  const expiration = expirationLabel(change.expiration);
  const semanticColor = change.isUnlimited
    ? "status.error.emphasis"
    : "status.warning.emphasis";
  const allowance = amountLabel(change);
  return (
    <Box
      py={2}
      borderTop="1px solid"
      borderColor="border.subtle"
      _first={{ borderTop: 0 }}
    >
      <HStack spacing={2.5} align="center" minH="32px">
        <Box flexShrink={0}>
          <TokenLogo
            logoUrl={change.logoUrl}
            symbol={change.symbol}
            alt={change.symbol}
            size="28px"
            fontSize="8px"
          />
        </Box>
        <Box minW={0}>
          <TokenContractPopover
            address={change.tokenAddress}
            explorer={explorerUrl || undefined}
            symbol={change.symbol}
            triggerColor="fg.primary"
          >
            <Text
              minW={0}
              fontSize="sm"
              fontWeight="600"
              lineHeight="short"
              overflowWrap="anywhere"
            >
              {change.symbol}
            </Text>
          </TokenContractPopover>
        </Box>
      </HStack>
      <VStack mt={2.5} spacing={1.5} align="stretch">
        <HStack minH="28px" spacing={3} align="baseline" justify="space-between">
          <Text flexShrink={0} fontSize="sm" color="fg.secondary">
            {unverified ? "Requested limit" : "Spending limit"}
          </Text>
          <Text
            minW={0}
            color={change.isUnlimited ? semanticColor : "fg.primary"}
            fontSize="sm"
            fontWeight="600"
            fontVariantNumeric="tabular-nums"
            overflowWrap="anywhere"
            textAlign="right"
            title={allowance}
          >
            {change.isUnlimited ? "Unlimited" : allowance}
          </Text>
        </HStack>
        <HStack minH="32px" spacing={3} minW={0} justify="space-between">
          <Text flexShrink={0} fontSize="sm" color="fg.secondary">
            Spender
          </Text>
          <LabeledAddressPopover
            chainId={chainId}
            account={null}
            address={change.spender}
            contextLabel="spender"
            explorer={explorerUrl || undefined}
            label={spenderLabel(change)}
            maxW="min(180px, 70%)"
          />
        </HStack>
      </VStack>
      {expiration && (
        <Text mt={1.5} fontSize="2xs" color="fg.secondary" overflowWrap="anywhere">
          {expiration}
        </Text>
      )}

      {unverified && (
        <Text
          mt={2}
          fontSize="2xs"
          color="status.warning.emphasis"
          lineHeight="short"
        >
          The final onchain allowance could not be verified.
        </Text>
      )}
    </Box>
  );
}

export function ApprovalChangesGroup({
  changes,
  detectionIncomplete,
  explorerUrl,
  chainId,
}: {
  changes: ApprovalChange[];
  detectionIncomplete: boolean;
  explorerUrl: string;
  chainId: number;
}) {
  const { themeId } = useTheme();
  const isMidnight = themeId === "midnight";
  if (changes.length === 0) return null;
  const hasUnlimited = changes.some((change) => change.isUnlimited);
  return (
    <Box
      role="alert"
      bg={isMidnight ? "surface.raisedHover" : undefined}
      mx={isMidnight ? -3 : 0}
      px={isMidnight ? 3 : 0}
      pb={isMidnight ? 2 : 0}
    >
      <HStack spacing={1.5} pt={2} pb={1}>
        <WarningTwoIcon
          boxSize="12px"
          flexShrink={0}
          color={hasUnlimited ? "status.error.emphasis" : "status.warning.emphasis"}
          aria-hidden
        />
        <Text fontSize="xs" fontWeight="600" color="fg.secondary">
          {changes.length === 1 ? "Approval changed" : "Approvals changed"}
        </Text>
        <Tooltip
          label="This is the approval allowance left unconsumed at the end of the transaction. The spender can use it to spend your tokens later."
          hasArrow
          placement="top"
        >
          <IconButton
            aria-label="About remaining approval allowance"
            icon={<InfoOutlineIcon boxSize="12px" />}
            variant="ghost"
            size="xs"
            minW="24px"
            w="24px"
            h="24px"
            color="fg.secondary"
          />
        </Tooltip>
      </HStack>
      <VStack align="stretch" spacing={0}>
        {changes.map((change) => (
          <ApprovalRow
            chainId={chainId}
            key={[
              change.system,
              change.tokenAddress,
              change.owner,
              change.spender,
            ].join(":")}
            change={change}
            explorerUrl={explorerUrl}
          />
        ))}
      </VStack>
      {detectionIncomplete && (
        <HStack
          spacing={1.5}
          py={2.5}
          align="flex-start"
          borderTop="1px solid"
          borderColor="border.subtle"
        >
          <WarningTwoIcon
            mt="1px"
            boxSize="10px"
            flexShrink={0}
            color="status.warning.emphasis"
          />
          <Text
            fontSize="2xs"
            color="status.warning.emphasis"
            lineHeight="short"
          >
            Additional approvals may be present.
          </Text>
        </HStack>
      )}
    </Box>
  );
}
