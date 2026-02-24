"use client";

import { Box, Container, Flex, Text } from "@chakra-ui/react";
import { Navigation } from "../components/Navigation";
import { SwapCard } from "./components/SwapCard";

export default function SwapWchanPage() {
  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />

      <Box
        bg="bauhaus.blue"
        position="relative"
        overflow="hidden"
        minH="calc(100vh - 73px)"
      >
        {/* Geometric background decorators */}
        <Box
          position="absolute"
          top={-20}
          right={-20}
          w={{ base: 40, lg: 72 }}
          h={{ base: 40, lg: 72 }}
          bg="bauhaus.yellow"
          opacity={0.15}
          borderRadius="full"
        />
        <Box
          position="absolute"
          bottom={10}
          left={-10}
          w={{ base: 32, lg: 48 }}
          h={{ base: 32, lg: 48 }}
          bg="bauhaus.red"
          opacity={0.1}
          transform="rotate(45deg)"
        />
        <Box
          position="absolute"
          top="40%"
          left="10%"
          w={0}
          h={0}
          borderLeft="30px solid transparent"
          borderRight="30px solid transparent"
          borderBottom="52px solid"
          borderBottomColor="bauhaus.yellow"
          opacity={0.1}
          display={{ base: "none", lg: "block" }}
        />

        <Container maxW="7xl" py={{ base: 12, md: 20 }}>
          <Flex
            direction="column"
            align="center"
            gap={{ base: 6, md: 8 }}
          >
            <Text
              color="white"
              fontWeight="black"
              fontSize={{ base: "2xl", md: "4xl" }}
              textTransform="uppercase"
              letterSpacing="tight"
              textAlign="center"
            >
              Swap ETH &harr; WCHAN
            </Text>
            <Text
              color="whiteAlpha.800"
              fontWeight="medium"
              fontSize={{ base: "sm", md: "md" }}
              textAlign="center"
              maxW="md"
            >
              Swap directly through the WCHAN Uniswap V4 pool on Base.
            </Text>

            <SwapCard />
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
