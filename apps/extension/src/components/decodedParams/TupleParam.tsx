import { VStack, Code } from "@chakra-ui/react";
import type { DecodeTupleParamResult } from "@/lib/decoder/types";
import { renderParams } from "@/components/renderParams";

interface TupleParamProps {
  value: DecodeTupleParamResult;
  chainId: number;
}

export function TupleParam({ value, chainId }: TupleParamProps) {
  // Null / empty tuple
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="text.tertiary" fontWeight="600" p={0}>
        ()
      </Code>
    );
  }

  // Array of Arg-like objects — render each via renderParams
  return (
    <VStack align="start" spacing={1} w="full">
      {value.map((item, i) => renderParams(i, item, chainId))}
    </VStack>
  );
}
