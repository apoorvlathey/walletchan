import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";

import type { FeePaymentOption } from "@/chrome/feePayment/capabilities";
import type { FeePaymentTokenId } from "@/chrome/feePayment/tokens";
import ShapesLoader from "@/components/Chat/ShapesLoader";
import TokenLogo from "@/components/TokenLogo";
import { ActionSheet } from "@/components/ui";
import {
  formatTokenAmount,
  type NativeFeePaymentSummary,
} from "@/components/feePaymentUi";

import { useFeePaymentOptions } from "./hooks/useFeePaymentOptions";
import { FeeQuoteError } from "./FeeQuoteError";
import { isTransactionSignatureExpired } from "./model/quoteError";
import { useFeePaymentQuote } from "./hooks/useFeePaymentQuote";

export type FeePaymentRequestKind =
  | "transaction"
  | "batch"
  | "crossDapp"
  | "safe"
  | "swap";

interface FeePaymentSelectorProps {
  txId: string;
  chainId: number;
  value: FeePaymentTokenId;
  quote: FeePaymentQuoteSummary | null;
  disabled?: boolean;
  onExpiredRequestRetry?: () => void;
  requestKind?: FeePaymentRequestKind;
  accountId?: string;
  requestPayload?: {
    chainId: number;
    calls: Array<{ to: string; data?: string; value?: string }>;
  };
  nativeSummary?: NativeFeePaymentSummary | null;
  onOptionsLoadingChange?: (loading: boolean) => void;
  onChange: (value: FeePaymentTokenId) => void;
  onQuoteChange: (quote: FeePaymentQuoteSummary | null) => void;
}

export interface FeePaymentQuoteSummary {
  quoteId: string | null;
  tokenId: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenStablecoin: boolean;
  maximumTokenCost: string;
  tokenBalance: string;
  expiresAt: number;
  approvalAdded: boolean;
  approvalAmount: string | null;
  paymaster: `0x${string}`;
  userOperationNonce: `0x${string}`;
  sufficientBalance: boolean;
  needsAuthorization: boolean;
}

export function FeePaymentSelector({
  txId,
  chainId,
  value,
  quote,
  disabled,
  onExpiredRequestRetry,
  requestKind = "transaction",
  accountId,
  requestPayload,
  nativeSummary,
  onOptionsLoadingChange,
  onChange,
  onQuoteChange,
}: FeePaymentSelectorProps) {
  const { options, loading, identity: requestIdentity, markManualSelection } = useFeePaymentOptions({
    txId, chainId, requestKind, accountId, requestPayload, value,
    nativeInsufficient: nativeSummary?.insufficient === true,
    disabled: Boolean(disabled), onChange, onOptionsLoadingChange,
  });
  const { quoteLoading, quoteError, requestQuote, resetQuoteState } = useFeePaymentQuote({
    requestIdentity, txId, requestKind, accountId, requestPayload,
    value, quote, options, disabled: Boolean(disabled), onQuoteChange,
  });
  const sheet = useDisclosure();
  const isTokenPayment = value !== "native";

  const selected = options.find((option) => option.id === value);
  const maximumTokenCost = quote?.maximumTokenCost ?? null;
  const tokenBalance = quote?.tokenBalance ?? selected?.balance ?? null;
  const tokenDecimals = quote?.tokenDecimals ?? selected?.decimals ?? 18;
  const tokenSymbol = quote?.tokenSymbol ?? selected?.symbol ?? "Token";
  const isStablecoin = quote?.tokenStablecoin ?? selected?.stablecoin === true;
  const approvalAdded = quote?.approvalAdded === true;
  const sufficientBalance = quote?.sufficientBalance !== false;
  const formattedMaximum = maximumTokenCost
    ? formatTokenAmount(maximumTokenCost, tokenDecimals)
    : null;
  const formattedBalance = tokenBalance
    ? formatTokenAmount(tokenBalance, tokenDecimals)
    : null;
  const displayedQuoteError = quoteError || (
    quote && !quote.sufficientBalance
      ? `Insufficient ${tokenSymbol} balance for the maximum gas charge`
      : ""
  );
  const tokenLogo = (option: FeePaymentOption, size = "18px") => (
    <TokenLogo
      symbol={option.symbol}
      logoUrl={option.logoUrl}
      nativeChainId={option.id === "native" ? chainId : undefined}
      size={size}
      fontSize="7px"
    />
  );
  const selectOption = (optionId: string) => {
    const option = options.find((candidate) => candidate.id === optionId);
    if (!option?.available) return;
    markManualSelection();
    onChange(option.id);
    sheet.onClose();
    if (option.id === "native") {
      resetQuoteState();
      onQuoteChange(null);
    } else {
      requestQuote(option.id);
    }
  };

  return (
    <VStack align="stretch" spacing={1.5}>
      <HStack justify="space-between" minH="30px">
        <Text color="fg.secondary" fontSize="xs" fontWeight="600">
          Pay network fee with
        </Text>
        {loading ? <Spinner size="xs" color="accent.highlight" /> : (
          <Button
            size="xs"
            h="30px"
            px={3}
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="surface.raised"
            color="fg.primary"
            fontSize="xs"
            isDisabled={disabled || options.length < 2}
            rightIcon={<ChevronDownIcon />}
            _hover={{ bg: "surface.raisedHover" }}
            onClick={sheet.onOpen}
          >
            <HStack spacing={1.5}>
              {selected && tokenLogo(selected)}
              <Text as="span" fontSize="xs" fontWeight="700">
                {selected?.symbol ?? "Choose"}
              </Text>
            </HStack>
          </Button>
        )}
      </HStack>
      {isTokenPayment && quoteLoading && !quote?.quoteId && (
        <HStack w="full" justify="center" spacing={2} role="status" aria-live="polite">
          <ShapesLoader size="6px" />
          <Text color="fg.muted" fontSize="2xs">Estimating Fees</Text>
        </HStack>
      )}
      {isTokenPayment && formattedMaximum && (
        <HStack
          justify="space-between" align="start" spacing={3}
          pt={2} mt={1} borderTopWidth="1px" borderColor="border.subtle"
          data-token-fee-summary
        >
          <Text color="fg.secondary" fontSize="xs" fontWeight="600" flexShrink={0}>
            Maximum fee
          </Text>
          <VStack align="end" spacing={0.5} minW={0} textAlign="right">
            <Text
              color={sufficientBalance ? "fg.primary" : "status.error.fg"}
              fontSize="sm" fontWeight="600" lineHeight="short"
              sx={{ fontVariantNumeric: "tabular-nums" }} overflowWrap="anywhere"
            >
              {formattedMaximum}{" "}
              <Text as="span" color="fg.secondary" fontSize="xs" fontWeight="500">
                {tokenSymbol}
              </Text>
            </Text>
            {isStablecoin && (
              <Text color="fg.muted" fontSize="2xs" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {Number(formattedMaximum) > 0 && Number(formattedMaximum) < 0.01
                  ? "< $0.01"
                  : `≈ ${new Intl.NumberFormat("en-US", {
                      style: "currency", currency: "USD",
                    }).format(Number(formattedMaximum))}`}
              </Text>
            )}
          </VStack>
        </HStack>
      )}
      <ActionSheet
        isOpen={sheet.isOpen}
        onClose={sheet.onClose}
        title="Pay network fee with"
        description="Choose the asset used only for this transaction's network fee."
        choices={options.map((option) => {
          const isSelectedToken = option.id === value;
          const optionBalance = isSelectedToken && formattedBalance
            ? formattedBalance
            : option.balance
              ? formatTokenAmount(option.balance, option.decimals)
              : null;
          return {
            id: option.id,
            label: option.symbol,
            icon: tokenLogo(option, "24px"),
            description: option.unavailableReason ??
              (option.id !== "native"
                ? isSelectedToken && formattedMaximum
                  ? `${sufficientBalance ? "" : "Insufficient balance · "}Up to ${formattedMaximum} ${option.symbol}${option.stablecoin ? ` (≈ $${formattedMaximum})` : ""} · Balance ${optionBalance ?? "—"}`
                  : optionBalance
                    ? `Balance ${optionBalance} ${option.symbol}`
                    : "Balance unavailable"
                : nativeSummary
                  ? `${nativeSummary.insufficient ? "Insufficient balance · " : ""}${nativeSummary.amount}${nativeSummary.fiat ? ` · ${nativeSummary.fiat}` : ""} · Balance ${nativeSummary.balance}`
                  : "Pay directly with the chain's native token"),
            isSelected: isSelectedToken,
            isDisabled: !option.available,
          };
        })}
        footer={isTokenPayment ? (
          <Text color="fg.muted" fontSize="2xs" lineHeight="short">
            Routed by Pimlico through EntryPoint v0.7. {approvalAdded
              ? `The atomic operation includes an exact, bounded ${tokenSymbol} approval.`
              : `Your current ${tokenSymbol} allowance already covers the bounded maximum.`}
          </Text>
        ) : undefined}
        onSelect={selectOption}
      />
      {isTokenPayment && displayedQuoteError && (
        <FeeQuoteError
          error={displayedQuoteError} isSwap={requestKind === "swap"}
          disabled={disabled}
          onRetry={() => {
            if (onExpiredRequestRetry && isTransactionSignatureExpired(displayedQuoteError)) {
              onExpiredRequestRetry();
            } else requestQuote();
          }}
        />
      )}
    </VStack>
  );
}
