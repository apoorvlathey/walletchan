"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Button,
} from "@chakra-ui/react";
import { Search } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Navigation } from "../components/Navigation";
import { AppCard } from "./components/AppCard";
import { IframeApp } from "./components/IframeApp";
import { DAPPS, CHAIN_NAMES } from "./data/dapps";
import type { DappEntry } from "./data/dapps";

export default function AppsPage() {
  const [search, setSearch] = useState("");
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [activeDapp, setActiveDapp] = useState<DappEntry | null>(null);

  // Derive unique chain IDs from the dapps data
  const availableChains = useMemo(() => {
    const chainSet = new Set<number>();
    DAPPS.forEach((dapp) => dapp.chains.forEach((c) => chainSet.add(c)));
    // Sort by CHAIN_NAMES order (known chains first), then by ID
    const knownOrder = Object.keys(CHAIN_NAMES).map(Number);
    return Array.from(chainSet).sort((a, b) => {
      const aIdx = knownOrder.indexOf(a);
      const bIdx = knownOrder.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a - b;
    });
  }, []);

  const filteredDapps = useMemo(() => {
    return DAPPS.filter((dapp) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        dapp.name.toLowerCase().includes(q) ||
        dapp.description.toLowerCase().includes(q) ||
        dapp.url.toLowerCase().includes(q);
      const matchesChain =
        !selectedChain || dapp.chains.includes(selectedChain);
      return matchesSearch && matchesChain;
    });
  }, [search, selectedChain]);

  // If a dapp is selected, show the iframe view
  if (activeDapp) {
    return (
      <IframeApp
        appUrl={activeDapp.url}
        appName={activeDapp.name}
        supportedChains={activeDapp.chains}
        onBack={() => setActiveDapp(null)}
      />
    );
  }

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />

      <Container maxW="7xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <VStack spacing={3} textAlign="center">
            <HStack spacing={3} justify="center">
              <Box w="16px" h="16px" bg="bauhaus.red" border="3px solid" borderColor="bauhaus.black" />
              <Text
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="900"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Explore dApps
              </Text>
              <Box
                w="16px"
                h="16px"
                bg="bauhaus.blue"
                border="3px solid"
                borderColor="bauhaus.black"
                borderRadius="full"
              />
            </HStack>
            <Text
              fontSize="md"
              color="gray.600"
              maxW="500px"
              fontWeight="500"
            >
              Browse and interact with dApps directly through BankrWallet.
              Connect your wallet to get started.
            </Text>
            <ConnectButton />
          </VStack>

          {/* Search */}
          <Box maxW="500px" mx="auto" w="full">
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Search size={16} color="gray" />
              </InputLeftElement>
              <Input
                placeholder="Search dApps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bg="white"
                border="3px solid"
                borderColor="bauhaus.black"
                borderRadius="0"
                fontWeight="600"
                _focus={{
                  borderColor: "bauhaus.blue",
                  boxShadow: "none",
                }}
              />
            </InputGroup>
          </Box>

          {/* Chain filter chips */}
          <HStack spacing={2} flexWrap="wrap" justify="center">
            <Button
              size="xs"
              bg={selectedChain === null ? "bauhaus.blue" : "white"}
              color={selectedChain === null ? "white" : "bauhaus.black"}
              border="2px solid"
              borderColor="bauhaus.black"
              borderRadius="0"
              fontWeight="800"
              textTransform="uppercase"
              fontSize="10px"
              letterSpacing="wide"
              onClick={() => setSelectedChain(null)}
              _hover={{ opacity: 0.8 }}
            >
              All Chains
            </Button>
            {availableChains.map((chainId) => (
              <Button
                key={chainId}
                size="xs"
                bg={selectedChain === chainId ? "bauhaus.blue" : "white"}
                color={selectedChain === chainId ? "white" : "bauhaus.black"}
                border="2px solid"
                borderColor="bauhaus.black"
                borderRadius="0"
                fontWeight="800"
                textTransform="uppercase"
                fontSize="10px"
                letterSpacing="wide"
                onClick={() =>
                  setSelectedChain(selectedChain === chainId ? null : chainId)
                }
                _hover={{ opacity: 0.8 }}
              >
                {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
              </Button>
            ))}
          </HStack>

          {/* Dapp Grid */}
          {filteredDapps.length > 0 ? (
            <SimpleGrid
              columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
              spacing={4}
            >
              {filteredDapps.map((dapp) => (
                <AppCard
                  key={dapp.id}
                  dapp={dapp}
                  onClick={() => setActiveDapp(dapp)}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Box textAlign="center" py={12}>
              <Text
                fontWeight="700"
                textTransform="uppercase"
                color="gray.500"
              >
                No dApps found
              </Text>
              <Text fontSize="sm" color="gray.400" mt={2}>
                Try adjusting your search or filters
              </Text>
            </Box>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
