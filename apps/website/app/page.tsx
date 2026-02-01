"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  HStack,
  VStack,
  Flex,
  Image,
} from "@chakra-ui/react";

export default function Home() {
  return (
    <Box as="main" minH="100vh" bg="bauhaus.background">
      {/* Hero Section */}
      <Box
        position="relative"
        overflow="hidden"
        borderBottom="4px solid"
        borderColor="bauhaus.black"
      >
        <Container maxW="7xl" py={{ base: 16, md: 24, lg: 32 }}>
          <Flex
            direction={{ base: "column", lg: "row" }}
            align="center"
            gap={{ base: 8, lg: 16 }}
          >
            {/* Left: Text Content */}
            <VStack
              align={{ base: "center", lg: "flex-start" }}
              spacing={6}
              flex={1}
              textAlign={{ base: "center", lg: "left" }}
            >
              <Heading
                as="h1"
                fontSize={{ base: "3xl", sm: "5xl", lg: "7xl" }}
                lineHeight="0.9"
              >
                PULL YOUR BANKR
                <br />
                WALLET INTO
                <br />
                <Box as="span" color="bauhaus.red">
                  ANY DAPP
                </Box>
              </Heading>

              <Text
                fontSize={{ base: "lg", md: "xl" }}
                color="text.secondary"
                maxW="md"
                fontWeight="medium"
              >
                Like MetaMask, but powered by AI. Transaction execution through
                the Bankr API. No seed phrases needed.
              </Text>

              <HStack spacing={4} pt={4}>
                <Button
                  variant="primary"
                  size="lg"
                  as="a"
                  href="https://github.com/bankr-wallet/bankr-wallet/releases"
                  target="_blank"
                >
                  Add to Chrome
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  as="a"
                  href="https://github.com/bankr-wallet/bankr-wallet"
                  target="_blank"
                >
                  View on GitHub
                </Button>
              </HStack>

              <Text fontSize="sm" color="text.tertiary" fontWeight="bold">
                Works on: Chrome · Brave · Arc
              </Text>
            </VStack>

            {/* Right: Geometric Composition */}
            <Box
              flex={1}
              position="relative"
              display={{ base: "none", lg: "block" }}
              h="400px"
            >
              {/* Yellow circle */}
              <Box
                position="absolute"
                top={0}
                right={0}
                w="200px"
                h="200px"
                bg="bauhaus.yellow"
                borderRadius="full"
                opacity={0.8}
              />
              {/* Red rotated square */}
              <Box
                position="absolute"
                bottom="60px"
                left="40px"
                w="120px"
                h="120px"
                bg="bauhaus.red"
                transform="rotate(45deg)"
                opacity={0.7}
              />
              {/* Blue rectangle */}
              <Box
                position="absolute"
                top="100px"
                left="80px"
                w="180px"
                h="80px"
                bg="bauhaus.blue"
                opacity={0.6}
              />
              {/* Mascot placeholder */}
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                zIndex={1}
              >
                <Image
                  src="/images/bankrwallet-animated.gif"
                  alt="BankrWallet Mascot"
                  w="150px"
                  h="150px"
                  border="4px solid"
                  borderColor="bauhaus.black"
                  bg="white"
                />
              </Box>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Stats Bar */}
      <Box
        bg="bauhaus.yellow"
        borderBottom="4px solid"
        borderColor="bauhaus.black"
      >
        <Container maxW="7xl">
          <Flex
            py={8}
            justify="space-around"
            align="center"
            direction={{ base: "column", md: "row" }}
            gap={{ base: 6, md: 0 }}
          >
            <VStack spacing={1}>
              <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="black">
                4+
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                Chains Supported
              </Text>
            </VStack>
            <Box
              w="4px"
              h="60px"
              bg="bauhaus.black"
              display={{ base: "none", md: "block" }}
            />
            <VStack spacing={1}>
              <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="black">
                50+
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                Transactions Per Day
              </Text>
            </VStack>
            <Box
              w="4px"
              h="60px"
              bg="bauhaus.black"
              display={{ base: "none", md: "block" }}
            />
            <VStack spacing={1}>
              <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="black">
                100%
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                Open-Source
              </Text>
            </VStack>
          </Flex>
        </Container>
      </Box>

      {/* Coming Soon Placeholder */}
      <Box py={24}>
        <Container maxW="7xl">
          <VStack spacing={8} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "4xl" }}>
              FULL WEBSITE COMING SOON
            </Heading>
            <Text fontSize="lg" color="text.secondary" maxW="2xl">
              This is the scaffolded landing page structure. The complete
              website with all sections from WEBSITE.md will be built out
              incrementally.
            </Text>
            <HStack spacing={4}>
              <Box w="16px" h="16px" bg="bauhaus.red" borderRadius="full" />
              <Box
                w="16px"
                h="16px"
                bg="bauhaus.blue"
                transform="rotate(45deg)"
              />
              <Box
                w={0}
                h={0}
                borderLeft="8px solid transparent"
                borderRight="8px solid transparent"
                borderBottom="14px solid"
                borderBottomColor="bauhaus.yellow"
              />
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Footer */}
      <Box bg="bauhaus.black" py={8}>
        <Container maxW="7xl">
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align="center"
            gap={4}
          >
            <HStack spacing={2}>
              <Box w="12px" h="12px" bg="bauhaus.red" borderRadius="full" />
              <Box
                w="12px"
                h="12px"
                bg="bauhaus.blue"
                transform="rotate(45deg)"
              />
              <Box
                w={0}
                h={0}
                borderLeft="6px solid transparent"
                borderRight="6px solid transparent"
                borderBottom="10px solid"
                borderBottomColor="bauhaus.yellow"
              />
              <Text
                color="white"
                fontWeight="black"
                textTransform="uppercase"
                ml={2}
              >
                BankrWallet
              </Text>
            </HStack>
            <Text color="whiteAlpha.700" fontSize="sm">
              Built by{" "}
              <Box
                as="a"
                href="https://x.com/apoorveth"
                target="_blank"
                color="bauhaus.yellow"
                fontWeight="bold"
                _hover={{ textDecoration: "underline" }}
              >
                @apoorveth
              </Box>
            </Text>
            <Text color="whiteAlpha.500" fontSize="sm">
              © 2025 BankrWallet
            </Text>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
