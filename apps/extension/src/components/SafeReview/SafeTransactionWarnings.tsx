import { WarningIcon } from "@chakra-ui/icons";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  type SafeTransactionRisk,
  analyzeSafeTransactionRisk,
  analyzeSafeTypedDataRisk,
} from "@/chrome/safe/transactionRisk";
import { InlineDisclosure } from "@/components/ui";

type AnalysisProps = {
  chainId: number;
  children?: ReactNode;
  hideWarnings?: boolean;
} & ({ typedData: unknown; transaction?: never } | { transaction: unknown; typedData?: never });

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <HStack
      role="note" aria-label={title} align="start" spacing={2.5} p={3}
      bg="status.error.bg" color="status.error.fg"
      borderWidth="1px" borderColor="status.error.border" borderRadius="lg"
    >
      <WarningIcon boxSize={3.5} mt={0.5} flexShrink={0} aria-hidden />
      <Box minW={0} flex={1}>
        <Text fontSize="sm" fontWeight="600">{title}</Text>
        {children}
      </Box>
    </HStack>
  );
}

/** Always outside clear-signing/simulation branches; never changes signed data. */
export function SafeTransactionWarnings(props: AnalysisProps | { risk: SafeTransactionRisk; children?: ReactNode; hideWarnings?: boolean }) {
  if (props.hideWarnings) return <>{props.children}</>;
  const risk = "risk" in props ? props.risk : "transaction" in props
    ? analyzeSafeTransactionRisk(props.transaction, props.chainId)
    : analyzeSafeTypedDataRisk(props.typedData, props.chainId);
  if (!risk?.delegatecall && !risk?.refund) return <>{props.children}</>;
  return (
    <VStack align="stretch" spacing={3} minW={0}>
      {risk.delegatecall && (
        <Notice title="Delegatecall can change your Safe">
          <Text fontSize="xs" mt={1}>
            This transaction allows another contract’s code to run with your Safe’s authority.
            It could change control of the Safe or move its funds.
          </Text>
        </Notice>
      )}
      {risk.refund && (
        <Notice title="Gas reimbursement enabled">
          <Text fontSize="xs" mt={1}>
            This transaction authorizes an additional payment from your Safe for execution costs.
          </Text>
          <InlineDisclosure
            label="Payment details" mt={2} autoScrollOnOpen
            sx={{
              borderTopColor: "status.error.border",
              "& > summary": {
                mx: -2,
                color: "status.error.fg",
                "&:hover": { bg: "status.error.bg" },
                "& > svg": { color: "status.error.fg" },
              },
            }}
          >
            <VStack align="stretch" spacing={2} pt={2}>
              <Box>
                <Text fontSize="xs" fontWeight="600">Payment asset</Text>
                <Text fontSize="xs" overflowWrap="anywhere">
                  {risk.refund.gasToken.toLowerCase() === ZERO_ADDRESS
                    ? "Native currency" : risk.refund.gasToken}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="600">Recipient</Text>
                <Text fontSize="xs" overflowWrap="anywhere">
                  {risk.refund.refundReceiver.toLowerCase() === ZERO_ADDRESS
                    ? "Transaction submitter" : risk.refund.refundReceiver}
                </Text>
              </Box>
            </VStack>
          </InlineDisclosure>
        </Notice>
      )}
      {props.children}
    </VStack>
  );
}
