"use client";

import {
  Box,
  Container,
  Flex,
  HStack,
  VStack,
  Text,
  Link,
  IconButton,
  useClipboard,
  Image,
} from "@chakra-ui/react";
import { Copy, Check } from "lucide-react";
import { LogoShapes } from "./ui/GeometricShape";
import {
  TOKEN_ADDRESS,
  GITHUB_URL,
  TWITTER_URL,
  BANKR_API_URL,
} from "../constants";

// Custom X (Twitter) icon
function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const { hasCopied, onCopy } = useClipboard(TOKEN_ADDRESS);
  const truncatedAddress = `${TOKEN_ADDRESS.slice(0, 6)}...${TOKEN_ADDRESS.slice(-4)}`;

  return (
    <Box bg="bauhaus.black" py={{ base: 8, md: 16 }}>
      <Container maxW="7xl">
        <VStack spacing={{ base: 6, md: 8 }}>
          {/* Main Footer Content */}
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "center", md: "flex-start" }}
            w="full"
            gap={{ base: 6, md: 8 }}
          >
            {/* Logo and Tagline */}
            <VStack align={{ base: "center", md: "flex-start" }} spacing={3}>
              <HStack spacing={3}>
                <Image
                  border="4px solid"
                  borderColor="white"
                  src="/images/bankrwallet-animated.gif"
                  alt="BankrWallet"
                  w="32px"
                  h="32px"
                />
                <Text
                  color="white"
                  fontWeight="black"
                  fontSize="xl"
                  textTransform="uppercase"
                >
                  BANKRWALLET
                </Text>
              </HStack>
              <Text
                color="whiteAlpha.700"
                maxW="300px"
                fontSize="sm"
                textAlign={{ base: "center", md: "left" }}
              >
                Your Bankr wallet, anywhere!
              </Text>

              {/* Contract Address */}
              <HStack>
                <Text color="whiteAlpha.500" fontSize="xs">
                  Contract:
                </Text>
                <Text color="whiteAlpha.700" fontFamily="mono" fontSize="xs">
                  {truncatedAddress}
                </Text>
                <IconButton
                  aria-label="Copy address"
                  icon={hasCopied ? <Check size={14} /> : <Copy size={14} />}
                  size="xs"
                  variant="ghost"
                  color="whiteAlpha.700"
                  onClick={onCopy}
                  _hover={{ color: "white", bg: "whiteAlpha.200" }}
                />
              </HStack>
            </VStack>

            {/* Links - Horizontal on mobile, vertical on desktop */}
            <VStack
              align={{ base: "center", md: "flex-start" }}
              spacing={3}
              display={{ base: "none", md: "flex" }}
            >
              <Text
                color="white"
                fontWeight="bold"
                textTransform="uppercase"
                fontSize="sm"
                letterSpacing="wider"
              >
                Links
              </Text>
              <Link
                href={GITHUB_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                GitHub
              </Link>
              <Link
                href={TWITTER_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Twitter
              </Link>
              <Link
                href={BANKR_API_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Bankr.bot
              </Link>
              <Link
                href="#install"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Install
              </Link>
            </VStack>

            {/* Mobile Links - Horizontal row */}
            <HStack
              spacing={4}
              display={{ base: "flex", md: "none" }}
              flexWrap="wrap"
              justify="center"
            >
              <Link
                href={GITHUB_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                GitHub
              </Link>
              <Text color="whiteAlpha.300">•</Text>
              <Link
                href={TWITTER_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Twitter
              </Link>
              <Text color="whiteAlpha.300">•</Text>
              <Link
                href={BANKR_API_URL}
                target="_blank"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Bankr.bot
              </Link>
              <Text color="whiteAlpha.300">•</Text>
              <Link
                href="#install"
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                Install
              </Link>
            </HStack>

            {/* Social - Desktop only as separate column */}
            <VStack
              align={{ base: "center", md: "flex-start" }}
              spacing={3}
              display={{ base: "none", md: "flex" }}
            >
              <Text
                color="white"
                fontWeight="bold"
                textTransform="uppercase"
                fontSize="sm"
                letterSpacing="wider"
              >
                Social
              </Text>
              <Link
                href={TWITTER_URL}
                target="_blank"
                display="flex"
                alignItems="center"
                gap={2}
                color="whiteAlpha.700"
                fontSize="sm"
                _hover={{ color: "bauhaus.yellow" }}
              >
                <XIcon size={16} />
                @apoorveth
              </Link>
            </VStack>
          </Flex>

          {/* Divider */}
          <Box w="full" h="2px" bg="whiteAlpha.200" />

          {/* Bottom Bar */}
          <Flex
            direction="row"
            justify={{ base: "center", md: "space-between" }}
            align="center"
            w="full"
            gap={4}
          >
            <Text color="whiteAlpha.500" fontSize="sm">
              Built by{" "}
              <Link
                href={TWITTER_URL}
                target="_blank"
                color="bauhaus.yellow"
                fontWeight="bold"
                _hover={{ textDecoration: "underline" }}
              >
                @apoorveth
              </Link>
            </Text>

            <HStack spacing={2}>
              <LogoShapes size="10px" />
            </HStack>

            <Text
              color="whiteAlpha.500"
              fontSize="sm"
              display={{ base: "none", md: "block" }}
            >
              © {new Date().getFullYear()} BankrWallet
            </Text>
          </Flex>
        </VStack>
      </Container>
    </Box>
  );
}
