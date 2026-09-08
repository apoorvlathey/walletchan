import {
  FormControl,
  FormLabel,
  HStack,
  Input,
  VStack,
} from "@chakra-ui/react";
import { InlineDisclosure } from "@/components/ui";

type CustomNetworkDetailsProps = {
  currencySymbol: string;
  currencyDecimals: string;
  onCurrencySymbolChange: (value: string) => void;
  onCurrencyDecimalsChange: (value: string) => void;
};

export function CustomNetworkDetails({
  currencySymbol,
  currencyDecimals,
  onCurrencySymbolChange,
  onCurrencyDecimalsChange,
}: CustomNetworkDetailsProps) {
  return (
    <InlineDisclosure
      label="Advanced network details"
      description="Native currency metadata"
    >
      <VStack spacing={4} align="stretch" pt={2}>
        <HStack spacing={3} align="flex-start">
          <FormControl flex={2}>
            <FormLabel mb={1.5} color="fg.secondary" fontSize="sm" fontWeight="500">
              Native token symbol
            </FormLabel>
            <Input
              value={currencySymbol}
              onChange={(event) => onCurrencySymbolChange(event.target.value.trim())}
            />
          </FormControl>
          <FormControl flex={1}>
            <FormLabel mb={1.5} color="fg.secondary" fontSize="sm" fontWeight="500">
              Decimals
            </FormLabel>
            <Input
              type="number"
              value={currencyDecimals}
              onChange={(event) => onCurrencyDecimalsChange(event.target.value)}
            />
          </FormControl>
        </HStack>
      </VStack>
    </InlineDisclosure>
  );
}
