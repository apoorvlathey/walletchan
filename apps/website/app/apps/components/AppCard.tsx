"use client";

import {
  Box,
  HStack,
  VStack,
  Text,
  Image,
  Badge,
} from "@chakra-ui/react";
import type { DappEntry } from "../data/dapps";
import { CHAIN_NAMES } from "../data/dapps";

interface AppCardProps {
  dapp: DappEntry;
  onClick: () => void;
}

export function AppCard({ dapp, onClick }: AppCardProps) {
  return (
    <Box
      as="button"
      w="full"
      bg="white"
      border="4px solid"
      borderColor="bauhaus.black"
      boxShadow="6px 6px 0px 0px var(--chakra-colors-bauhaus-black)"
      p={4}
      textAlign="left"
      cursor="pointer"
      transition="all 0.15s ease-out"
      _hover={{
        transform: "translate(-2px, -2px)",
        boxShadow: "8px 8px 0px 0px var(--chakra-colors-bauhaus-black)",
      }}
      _active={{
        transform: "translate(3px, 3px)",
        boxShadow: "none",
      }}
      onClick={onClick}
    >
      <HStack spacing={3} align="start">
        <Image
          src={dapp.iconUrl}
          alt={dapp.name}
          w="40px"
          h="40px"
          borderRadius="sm"
          border="2px solid"
          borderColor="bauhaus.black"
          fallbackSrc="https://www.google.com/s2/favicons?domain=example.com&sz=64"
        />
        <VStack align="start" spacing={1} flex={1} minW={0}>
          <Text
            fontWeight="900"
            fontSize="sm"
            textTransform="uppercase"
            letterSpacing="wide"
            noOfLines={1}
          >
            {dapp.name}
          </Text>
          <Text
            fontSize="xs"
            color="gray.600"
            noOfLines={2}
            lineHeight="short"
          >
            {dapp.description}
          </Text>
          <HStack spacing={1} flexWrap="wrap" mt={1}>
            {dapp.chains.map((chainId) => (
              <Badge
                key={chainId}
                bg="bauhaus.black"
                color="white"
                fontSize="9px"
                fontWeight="800"
                textTransform="uppercase"
                borderRadius="0"
                px={1.5}
              >
                {CHAIN_NAMES[chainId] || chainId}
              </Badge>
            ))}
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}
