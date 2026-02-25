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
  useClipboard,
  useDisclosure,
  Image,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useTokenData } from "../contexts/TokenDataContext";
import {
  TOKEN_ADDRESS,
  DEXSCREENER_URL,
  GECKOTERMINAL_URL,
  GECKOTERMINAL_EMBED_URL,
} from "../constants";
import { BuyModal, type BuyToken } from "../coins/components/BuyModal";

const MotionBox = motion(Box);

const WCHAN_TOKEN: BuyToken = {
  address: TOKEN_ADDRESS,
  name: "WalletChan",
  symbol: "WCHAN",
  imageUrl: "/images/walletchan-icon-nobg.png",
};

export function TokenSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const { hasCopied, onCopy } = useClipboard(TOKEN_ADDRESS);
  const { tokenData } = useTokenData();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const truncatedAddress = `${TOKEN_ADDRESS.slice(0, 6)}...${TOKEN_ADDRESS.slice(-4)}`;

  return (
    <Box
      id="token"
      bg="bauhaus.blue"
      py={{ base: 16, md: 24 }}
      position="relative"
      overflow="hidden"
      borderTop="6px solid"
      borderColor="bauhaus.border"
    >
      {/* Background decoration */}
      <Box
        position="absolute"
        top="-100px"
        right="-100px"
        w="300px"
        h="300px"
        bg="white"
        opacity={0.05}
        borderRadius="full"
      />

      <Container maxW="7xl" ref={ref}>
        <VStack spacing={{ base: 8, md: 12 }}>
          {/* Section Header */}
          <VStack spacing={4}>
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <Heading
                as="h2"
                fontSize={{ base: "3xl", md: "5xl" }}
                color="bauhaus.yellow"
              >
                $WCHAN
              </Heading>
            </MotionBox>
            <Box w="140px" h="4px" bg="white" />
          </VStack>

          {/* Contract Address */}
          <MotionBox
            position="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Geometric decorator - rotated square */}
            <Box
              position="absolute"
              top="-8px"
              left="-8px"
              w="16px"
              h="16px"
              bg="bauhaus.red"
              transform="rotate(45deg)"
              border="2px solid"
              borderColor="bauhaus.border"
            />
            <HStack
              spacing={0}
              bg="white"
              border="4px solid"
              borderColor="bauhaus.border"
              boxShadow="6px 6px 0px 0px #121212"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "8px 8px 0px 0px #121212",
              }}
              transition="all 0.2s ease-out"
              cursor="pointer"
              onClick={onCopy}
              role="group"
            >
              {/* CA Label with yellow background */}
              <Flex
                bg="bauhaus.yellow"
                px={4}
                py={3}
                align="center"
                alignSelf="stretch"
                borderRight="4px solid"
                borderColor="bauhaus.border"
              >
                <Text
                  color="bauhaus.foreground"
                  fontSize="sm"
                  fontWeight="black"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  CA
                </Text>
              </Flex>
              {/* Address */}
              <Flex px={4} py={3} align="center" flex={1}>
                <Text
                  color="bauhaus.foreground"
                  fontFamily="mono"
                  fontSize={{ base: "xs", md: "sm" }}
                  fontWeight="medium"
                  display={{ base: "none", md: "block" }}
                >
                  <Text as="span" fontWeight="black" color="bauhaus.blue" fontSize={{ base: "sm", md: "md" }}>
                    0xBa5ED0000
                  </Text>
                  {TOKEN_ADDRESS.slice(11)}
                </Text>
                <Text
                  color="bauhaus.foreground"
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="medium"
                  display={{ base: "block", md: "none" }}
                >
                  <Text as="span" fontWeight="black" color="bauhaus.blue" fontSize={{ base: "sm", md: "md" }}>
                    0xBa5ED0000
                  </Text>
                  ...{TOKEN_ADDRESS.slice(-4)}
                </Text>
              </Flex>
              {/* Copy Button */}
              <Flex
                bg={hasCopied ? "bauhaus.red" : "gray.400"}
                minW="50px"
                align="center"
                justify="center"
                alignSelf="stretch"
                borderLeft="4px solid"
                borderColor="bauhaus.border"
                _groupHover={{
                  bg: hasCopied ? "bauhaus.red" : "bauhaus.blue",
                }}
                transition="background 0.2s ease-out"
              >
                {hasCopied ? (
                  <Check size={18} stroke="white" />
                ) : (
                  <Copy size={18} stroke="white" />
                )}
              </Flex>
            </HStack>
            {/* Small circle decorator */}
            <Box
              position="absolute"
              bottom="-6px"
              right="20px"
              w="12px"
              h="12px"
              bg="bauhaus.yellow"
              borderRadius="full"
              border="2px solid"
              borderColor="bauhaus.border"
            />
          </MotionBox>

          {/* Price Display Card */}
          <MotionBox
            w="full"
            maxW="4xl"
            bg="bauhaus.black"
            border="4px solid"
            borderColor="bauhaus.black"
            p={{ base: 4, md: 8 }}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* GeckoTerminal Embed */}
            <Box
              as="iframe"
              id="geckoterminal-embed"
              title="GeckoTerminal Embed"
              src={GECKOTERMINAL_EMBED_URL}
              w="full"
              h={{ base: "350px", md: "500px" }}
              border="none"
              allow="clipboard-write"
              allowFullScreen
            />

            {/* Token Stats */}
            <Flex
              mt={6}
              justify="space-around"
              direction={{ base: "column", md: "row" }}
              gap={4}
            >
              <VStack>
                <Text color="whiteAlpha.700" fontSize="sm" fontWeight="bold">
                  MARKET CAP
                </Text>
                <Text color="white" fontSize="2xl" fontWeight="black">
                  {tokenData?.marketCap || "Loading..."}
                </Text>
              </VStack>
              <VStack>
                <Text color="whiteAlpha.700" fontSize="sm" fontWeight="bold">
                  24H CHANGE
                </Text>
                <Text
                  color={
                    tokenData?.change1d && tokenData.change1d >= 0
                      ? "green.400"
                      : "red.400"
                  }
                  fontSize="2xl"
                  fontWeight="black"
                >
                  {tokenData?.change1d !== undefined
                    ? `${tokenData.change1d >= 0 ? "+" : ""}${tokenData.change1d.toFixed(2)}%`
                    : "..."}
                </Text>
              </VStack>
              <VStack>
                <Text color="whiteAlpha.700" fontSize="sm" fontWeight="bold">
                  PRICE
                </Text>
                <Text color="white" fontSize="2xl" fontWeight="black">
                  {tokenData?.price || "..."}
                </Text>
              </VStack>
            </Flex>
          </MotionBox>

          {/* Action Buttons */}
          <HStack spacing={4} flexWrap="wrap" justify="center">
            <Button
              variant="yellow"
              size="lg"
              as="a"
              href={GECKOTERMINAL_URL}
              target="_blank"
              leftIcon={
                <Image
                  src="https://www.google.com/s2/favicons?domain=geckoterminal.com&sz=32"
                  alt="GeckoTerminal"
                  w="18px"
                  h="18px"
                />
              }
              rightIcon={<ExternalLink size={18} />}
            >
              GeckoTerminal
            </Button>
            <Button
              variant="yellow"
              size="lg"
              as="a"
              href={DEXSCREENER_URL}
              target="_blank"
              leftIcon={
                <Image
                  src="https://www.google.com/s2/favicons?domain=dexscreener.com&sz=32"
                  alt="DexScreener"
                  w="18px"
                  h="18px"
                />
              }
              rightIcon={<ExternalLink size={18} />}
            >
              DexScreener
            </Button>
            <Button
              variant="green"
              size="lg"
              onClick={onOpen}
            >
              Buy
            </Button>
          </HStack>
        </VStack>
      </Container>

      <BuyModal token={WCHAN_TOKEN} isOpen={isOpen} onClose={onClose} showWallet />
    </Box>
  );
}
