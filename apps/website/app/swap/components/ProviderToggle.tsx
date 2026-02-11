"use client";

import { HStack, Flex, Text } from "@chakra-ui/react";
import type { SwapProvider } from "../types";

interface ProviderToggleProps {
  provider: SwapProvider;
  onProviderChange: (provider: SwapProvider) => void;
}

const PROVIDERS: { key: SwapProvider; label: string }[] = [
  { key: "0x", label: "0x" },
  { key: "bungee", label: "Bungee" },
];

export function ProviderToggle({
  provider,
  onProviderChange,
}: ProviderToggleProps) {
  return (
    <HStack spacing={0}>
      {PROVIDERS.map((p, i) => {
        const isActive = provider === p.key;
        return (
          <Flex
            key={p.key}
            as="button"
            px={3}
            py={1}
            bg={isActive ? "bauhaus.blue" : "white"}
            color={isActive ? "white" : "bauhaus.foreground"}
            fontWeight="bold"
            fontSize="2xs"
            textTransform="uppercase"
            letterSpacing="wider"
            border="2px solid"
            borderColor="bauhaus.border"
            ml={i > 0 ? "-2px" : 0}
            onClick={() => onProviderChange(p.key)}
            _hover={{ opacity: 0.8 }}
            transition="all 0.15s"
          >
            <Text>{p.label}</Text>
          </Flex>
        );
      })}
    </HStack>
  );
}
