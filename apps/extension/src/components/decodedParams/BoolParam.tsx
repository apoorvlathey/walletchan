import { Text } from "@chakra-ui/react";

interface BoolParamProps {
  value: string;
}

export function BoolParam({ value }: BoolParamProps) {
  const boolVal = value === "true" || value === "1";

  return (
    <Text
      fontSize="xs"
      fontFamily="mono"
      color={boolVal ? "bauhaus.green" : "bauhaus.red"}
      fontWeight="700"
    >
      {String(boolVal)}
    </Text>
  );
}
