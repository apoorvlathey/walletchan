import { Box, HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ListSurface } from "@/components/ui";

export function SafeProposalNonceGroup({ nonce, count, children }: {
  nonce: number;
  count: number;
  children: ReactNode;
}) {
  return (
    <ListSurface as="div" role="group" aria-label={`Safe nonce ${nonce}`}>
      <HStack px={3} pt={3} pb={1} justify="space-between" spacing={3}>
        <Text as="h2" color="fg.secondary" fontSize="xs" fontWeight="600">
          Nonce <Text as="span" color="fg.primary">#{nonce}</Text>
        </Text>
        {count > 1 && (
          <Text color="fg.muted" fontSize="xs">{count} requests</Text>
        )}
      </HStack>
      <Box as="ul" listStyleType="none" m={0} p={0}>
        {children}
      </Box>
    </ListSurface>
  );
}
