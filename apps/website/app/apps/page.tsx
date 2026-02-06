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
import { Navigation } from "../components/Navigation";
import { AppCard } from "./components/AppCard";
import { IframeApp } from "./components/IframeApp";
import { DAPPS, ALL_CATEGORIES, CHAIN_NAMES } from "./data/dapps";
import type { DappEntry } from "./data/dapps";

export default function AppsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [activeDapp, setActiveDapp] = useState<DappEntry | null>(null);

  const filteredDapps = useMemo(() => {
    return DAPPS.filter((dapp) => {
      const matchesSearch =
        !search ||
        dapp.name.toLowerCase().includes(search.toLowerCase()) ||
        dapp.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !selectedCategory || dapp.categories.includes(selectedCategory);
      const matchesChain =
        !selectedChain || dapp.chains.includes(selectedChain);
      return matchesSearch && matchesCategory && matchesChain;
    });
  }, [search, selectedCategory, selectedChain]);

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

          {/* Filters */}
          <VStack spacing={3} align="stretch">
            {/* Category chips */}
            <HStack spacing={2} flexWrap="wrap" justify="center">
              <Button
                size="xs"
                bg={selectedCategory === null ? "bauhaus.black" : "white"}
                color={selectedCategory === null ? "white" : "bauhaus.black"}
                border="2px solid"
                borderColor="bauhaus.black"
                borderRadius="0"
                fontWeight="800"
                textTransform="uppercase"
                fontSize="10px"
                letterSpacing="wide"
                onClick={() => setSelectedCategory(null)}
                _hover={{ opacity: 0.8 }}
              >
                All
              </Button>
              {ALL_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  size="xs"
                  bg={selectedCategory === cat ? "bauhaus.black" : "white"}
                  color={selectedCategory === cat ? "white" : "bauhaus.black"}
                  border="2px solid"
                  borderColor="bauhaus.black"
                  borderRadius="0"
                  fontWeight="800"
                  textTransform="uppercase"
                  fontSize="10px"
                  letterSpacing="wide"
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  _hover={{ opacity: 0.8 }}
                >
                  {cat}
                </Button>
              ))}
            </HStack>

            {/* Chain chips */}
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
              {Object.entries(CHAIN_NAMES).map(([id, name]) => (
                <Button
                  key={id}
                  size="xs"
                  bg={selectedChain === Number(id) ? "bauhaus.blue" : "white"}
                  color={
                    selectedChain === Number(id) ? "white" : "bauhaus.black"
                  }
                  border="2px solid"
                  borderColor="bauhaus.black"
                  borderRadius="0"
                  fontWeight="800"
                  textTransform="uppercase"
                  fontSize="10px"
                  letterSpacing="wide"
                  onClick={() =>
                    setSelectedChain(
                      selectedChain === Number(id) ? null : Number(id)
                    )
                  }
                  _hover={{ opacity: 0.8 }}
                >
                  {name}
                </Button>
              ))}
            </HStack>
          </VStack>

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
