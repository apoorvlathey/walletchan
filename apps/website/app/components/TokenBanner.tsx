"use client";

import { Box, HStack, Text, Link, useDisclosure } from "@chakra-ui/react";
import { useTokenData } from "../contexts/TokenDataContext";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEXSCREENER_URL, TOKEN_ADDRESS } from "../constants";
import { BuyModal, type BuyToken } from "../coins/components/BuyModal";
import { LoadingShapes } from "./ui/LoadingShapes";

const MotionText = motion(Text);
const MotionBox = motion(Box);

const BNKRW_TOKEN: BuyToken = {
  address: TOKEN_ADDRESS,
  name: "BankrWallet",
  symbol: "BNKRW",
  imageUrl: "/images/bankrwallet-icon-nobg.png",
};

export function TokenBanner() {
  const { tokenData, isLoading } = useTokenData();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const prevDisplayRef = useRef<string | null>(null);
  const prevRawRef = useRef<number | null>(null);

  useEffect(() => {
    if (tokenData?.marketCap !== undefined) {
      const newDisplay = tokenData.marketCap;
      const newRaw = tokenData.marketCapRaw;
      const prevDisplay = prevDisplayRef.current;
      const prevRaw = prevRawRef.current;

      // Only animate if the displayed value actually changes
      if (
        prevDisplay !== null &&
        prevDisplay !== newDisplay &&
        prevRaw !== null
      ) {
        setDirection(newRaw > prevRaw ? "up" : "down");
        setIsAnimating(true);

        // Reset animation after it completes
        const timer = setTimeout(() => {
          setIsAnimating(false);
        }, 600);

        prevDisplayRef.current = newDisplay;
        prevRawRef.current = newRaw;
        setDisplayValue(newDisplay);

        return () => clearTimeout(timer);
      }

      prevDisplayRef.current = newDisplay;
      prevRawRef.current = newRaw;
      setDisplayValue(newDisplay);
    }
  }, [tokenData?.marketCap, tokenData?.marketCapRaw]);

  return (
    <Box position="sticky" top={0} zIndex={100}>
      <HStack
        bg="bauhaus.yellow"
        py={2}
        px={4}
        justify="center"
        spacing={{ base: 2, md: 3 }}
        borderBottom="3px solid"
        borderColor="bauhaus.black"
        flexWrap="wrap"
        rowGap={2}
      >
        {/* Left decorative square */}
        <Box
          w="6px"
          h="6px"
          bg="bauhaus.black"
          display={{ base: "none", md: "block" }}
        />

        {/* Powered by + $BNKRW group */}
        <HStack spacing={2}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color="bauhaus.black"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Powered by
          </Text>

          <Link
            href={DEXSCREENER_URL}
            isExternal
            bg="bauhaus.blue"
            color="white"
            px={3}
            py={1}
            fontWeight="900"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="wide"
            border="2px solid"
            borderColor="bauhaus.black"
            boxShadow="2px 2px 0px 0px #121212"
            _hover={{
              bg: "#F97316",
              color: "white",
              textDecoration: "none",
              transform: "translateY(-1px)",
              boxShadow: "3px 3px 0px 0px #121212",
            }}
            _active={{
              transform: "translate(2px, 2px)",
              boxShadow: "none",
            }}
            transition="all 0.2s ease-out"
          >
            $BNKRW
          </Link>
        </HStack>

        {/* Market Cap + Buy group */}
        <HStack spacing={2}>
          <HStack
            spacing={1}
            bg="white"
            border="2px solid"
            borderColor={isAnimating ? "bauhaus.green" : "bauhaus.black"}
            boxShadow={
              isAnimating
                ? "2px 2px 0px 0px #208040"
                : "2px 2px 0px 0px #121212"
            }
            px={3}
            py={1}
            transition="all 0.2s ease-out"
          >
            <Text
              fontSize="xs"
              fontWeight="700"
              color="bauhaus.black"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              MCap:
            </Text>
            {isLoading || !displayValue ? (
              <LoadingShapes />
            ) : (
              <Box
                position="relative"
                overflow="hidden"
                h="18px"
                minW="70px"
                display="flex"
                alignItems="center"
              >
                <AnimatePresence mode="popLayout">
                  <MotionText
                    key={displayValue}
                    fontSize="sm"
                    fontWeight="black"
                    color={isAnimating ? "bauhaus.green" : "bauhaus.blue"}
                    position="absolute"
                    whiteSpace="nowrap"
                    initial={{
                      y: direction === "up" ? 16 : -16,
                      opacity: 0,
                    }}
                    animate={{
                      y: 0,
                      opacity: 1,
                    }}
                    exit={{
                      y: direction === "up" ? -16 : 16,
                      opacity: 0,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                  >
                    {displayValue}
                  </MotionText>
                </AnimatePresence>
              </Box>
            )}
          </HStack>

          <Box
            as="button"
            bg="bauhaus.green"
            color="white"
            px={3}
            py={1}
            fontWeight="700"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="wider"
            border="2px solid"
            borderColor="bauhaus.black"
            boxShadow="2px 2px 0px 0px #121212"
            display="flex"
            alignItems="center"
            gap={1}
            onClick={onOpen}
            _hover={{
              opacity: 0.9,
              transform: "translateY(-1px)",
              boxShadow: "3px 3px 0px 0px #121212",
            }}
            _active={{
              transform: "translate(2px, 2px)",
              boxShadow: "none",
            }}
            transition="all 0.2s ease-out"
          >
            Buy
          </Box>
        </HStack>

        {/* Right decorative square */}
        <Box
          w="6px"
          h="6px"
          bg="bauhaus.black"
          display={{ base: "none", md: "block" }}
        />
      </HStack>
      <BuyModal token={BNKRW_TOKEN} isOpen={isOpen} onClose={onClose} showWallet />
    </Box>
  );
}
