"use client";

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  HStack,
  VStack,
  Image,
  Link,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { GITHUB_URL, COINGECKO_URL, CHROME_STORE_URL } from "../constants";

const MotionBox = motion(Box);

export function Hero() {
  return (
    <Box position="relative" overflow="hidden">
      <Flex direction={{ base: "column", lg: "row" }}>
        {/* Left Side - Content */}
        <Box
          flex={{ base: 1, lg: 0.6 }}
          bg="bauhaus.background"
          py={{ base: 12, md: 20, lg: 28 }}
          px={{ base: 4, md: 8 }}
        >
          <Container maxW="4xl">
            <VStack
              align={{ base: "center", lg: "flex-start" }}
              spacing={6}
              textAlign={{ base: "center", lg: "left" }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Heading
                  as="h1"
                  fontSize={{ base: "4xl", sm: "5xl", md: "6xl", lg: "8xl" }}
                  lineHeight="0.9"
                  letterSpacing="tighter"
                >
                  THE
                  <br />
                  WALLET
                  <br />
                  <Box as="span" color="bauhaus.red">
                    FOR AI ERA
                  </Box>
                </Heading>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Text
                  fontSize={{ base: "lg", md: "xl" }}
                  color="text.secondary"
                  maxW="xl"
                  fontWeight="medium"
                >
                  Bankr wallet address, in your browser!
                  <br />
                  Use with all the dapps you love ❤️
                </Text>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <HStack
                  spacing={4}
                  pt={4}
                  flexWrap="wrap"
                  justify={{ base: "center", lg: "flex-start" }}
                >
                  <Button
                    variant="primary"
                    size={{ base: "md", md: "lg" }}
                    as="a"
                    href={CHROME_STORE_URL}
                    target="_blank"
                  >
                    Add to Chrome
                  </Button>
                  <Button
                    variant="outline"
                    size={{ base: "md", md: "lg" }}
                    as="a"
                    href={GITHUB_URL}
                    target="_blank"
                  >
                    View on GitHub
                  </Button>
                </HStack>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Text
                  fontSize="sm"
                  color="text.tertiary"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Works on: Chrome · Brave · Arc
                </Text>
              </motion.div>
            </VStack>
          </Container>
        </Box>

        {/* Right Side - Yellow Panel with Geometric Composition */}
        <Box
          flex={{ base: 1, lg: 0.4 }}
          bg="bauhaus.yellow"
          position="relative"
          minH={{ base: "350px", lg: "auto" }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
          borderLeft={{ base: "none", lg: "4px solid" }}
          borderTop={{ base: "4px solid", lg: "none" }}
          borderColor="bauhaus.black"
        >
          {/* View on CoinGecko - top right */}
          <Link
            href={COINGECKO_URL}
            isExternal
            role="group"
            position="absolute"
            top={{ base: 3, md: 4 }}
            right={{ base: 3, md: 4 }}
            zIndex={10}
            bg="white"
            color="bauhaus.black"
            px={3}
            py={1.5}
            fontWeight="700"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="wider"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="3px 3px 0px 0px #121212"
            display="flex"
            alignItems="center"
            gap={2}
            _hover={{
              bg: "#8DC63F",
              color: "white",
              textDecoration: "none",
              transform: "translateY(-2px)",
              boxShadow: "4px 4px 0px 0px #121212",
            }}
            _active={{
              transform: "translate(3px, 3px)",
              boxShadow: "none",
            }}
            transition="all 0.2s ease-out"
          >
            Listed on
            <Box position="relative" h="24px" w="auto">
              <Image
                src="/images/coingecko.svg"
                alt="CoinGecko"
                h="24px"
                w="auto"
                _groupHover={{ opacity: 0 }}
                transition="opacity 0.2s ease-out"
              />
              <Image
                src="/images/coingecko-white.svg"
                alt="CoinGecko"
                h="24px"
                w="auto"
                position="absolute"
                top={0}
                left={0}
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s ease-out"
              />
            </Box>
            <ExternalLink size={14} />
          </Link>

          {/* Blue circle - top right */}
          <Box
            position="absolute"
            top={{ base: "-40px", lg: "-60px" }}
            right={{ base: "-40px", lg: "-50px" }}
            w={{ base: "160px", lg: "220px" }}
            h={{ base: "160px", lg: "220px" }}
            bg="bauhaus.blue"
            borderRadius="full"
            border="4px solid"
            borderColor="bauhaus.black"
          />

          {/* Red rotated square - bottom left */}
          <Box
            position="absolute"
            bottom={{ base: "30px", lg: "60px" }}
            left={{ base: "20px", lg: "30px" }}
            w={{ base: "80px", lg: "120px" }}
            h={{ base: "80px", lg: "120px" }}
            bg="bauhaus.red"
            transform="rotate(45deg)"
            border="4px solid"
            borderColor="bauhaus.black"
          />

          {/* Black square outline - decorative */}
          <Box
            position="absolute"
            top={{ base: "25%", lg: "20%" }}
            left={{ base: "10%", lg: "15%" }}
            w={{ base: "50px", lg: "70px" }}
            h={{ base: "50px", lg: "70px" }}
            border="4px solid"
            borderColor="bauhaus.black"
          />

          {/* Small red circle - accent */}
          <Box
            position="absolute"
            bottom={{ base: "25%", lg: "30%" }}
            right={{ base: "15%", lg: "20%" }}
            w={{ base: "30px", lg: "40px" }}
            h={{ base: "30px", lg: "40px" }}
            bg="bauhaus.red"
            borderRadius="full"
            border="3px solid"
            borderColor="bauhaus.black"
          />

          {/* Mascot with hard shadow */}
          <MotionBox
            position="relative"
            zIndex={1}
            boxShadow="8px 8px 0px 0px #121212"
            animate={{
              y: [0, -5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/walletchan-animated.gif"
              alt="WalletChan Mascot"
              w={{ base: "130px", md: "160px", lg: "200px" }}
              h={{ base: "130px", md: "160px", lg: "200px" }}
              border="4px solid"
              borderColor="bauhaus.black"
              bg="white"
            />
          </MotionBox>

          {/* Dot pattern overlay */}
          <Box
            position="absolute"
            inset={0}
            backgroundImage="radial-gradient(#121212 1.5px, transparent 1.5px)"
            backgroundSize="24px 24px"
            opacity={0.08}
            pointerEvents="none"
          />
        </Box>
      </Flex>
    </Box>
  );
}
