"use client";

import {
  Box,
  Container,
  Flex,
  HStack,
  Link,
  Button,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  useDisclosure,
  Image,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { LogoShapes } from "./ui/GeometricShape";
import { CHROME_STORE_URL } from "../constants";
import { useVaultData } from "../contexts/VaultDataContext";

const COINS_SUBDOMAIN = "coins.bankrwallet.app";
const COINS_SUBDOMAIN_URL = "https://coins.bankrwallet.app";
const STAKE_SUBDOMAIN = "stake.bankrwallet.app";
const STAKE_SUBDOMAIN_URL = "https://stake.bankrwallet.app";
const MAIN_SITE = "https://bankrwallet.app";

const revolveBorder = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const navLinks = [
  { label: "Token", href: "#token" },
  { label: "Coins", href: "/coins" },
  { label: "Stake", href: "/stake" },
  // { label: "Apps", href: "/apps" },
  { label: "Install", href: "#install" },
  { label: "Tweets", href: "#tweets" },
];

export function Navigation() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const pathname = usePathname();
  const { vaultData } = useVaultData();
  const [isCoinsSubdomain, setIsCoinsSubdomain] = useState(false);
  const [isStakeSubdomain, setIsStakeSubdomain] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsCoinsSubdomain(hostname === COINS_SUBDOMAIN);
    setIsStakeSubdomain(hostname === STAKE_SUBDOMAIN);
    setIsLocalhost(hostname === "localhost" || hostname === "127.0.0.1");
  }, []);

  const isOnSubdomain = isCoinsSubdomain || isStakeSubdomain;
  const isOnCoins = pathname === "/coins" || isCoinsSubdomain;
  const isOnStake = pathname === "/stake" || isStakeSubdomain;

  const getNavHref = (href: string) => {
    // On coins subdomain
    if (isCoinsSubdomain) {
      if (href === "/coins") return "/";
      if (href.startsWith("#")) return `${MAIN_SITE}/${href}`;
    }
    // On stake subdomain
    if (isStakeSubdomain) {
      if (href === "/stake") return "/";
      if (href.startsWith("#")) return `${MAIN_SITE}/${href}`;
    }
    // On production main site, route to subdomains
    if (!isLocalhost && !isOnSubdomain) {
      if (href === "/coins") return COINS_SUBDOMAIN_URL;
      if (href === "/stake") return STAKE_SUBDOMAIN_URL;
    }
    // On localhost /coins or /stake paths, anchor links need absolute path
    if (isLocalhost && (pathname === "/coins" || pathname === "/stake") && href.startsWith("#")) {
      return `/${href}`;
    }
    return href;
  };

  const logoHref = isOnSubdomain ? MAIN_SITE : "/";

  return (
    <Box
      as="nav"
      bg="bauhaus.background"
      borderBottom="4px solid"
      borderColor="bauhaus.black"
    >
      <Container maxW="7xl" py={4}>
        <Flex justify="space-between" align="center">
          {/* Logo */}
          <Link href={logoHref} _hover={{ textDecoration: "none" }}>
            <HStack spacing={3}>
              <Image
                src="/images/bankrwallet-icon-nobg.png"
                alt="BankrWallet"
                w="40px"
                h="40px"
              />
              <Box
                fontWeight="black"
                fontSize="xl"
                textTransform="uppercase"
                letterSpacing="tight"
              >
                BANKRWALLET
              </Box>
            </HStack>
          </Link>

          {/* Desktop Navigation */}
          <HStack spacing={8} display={{ base: "none", md: "flex" }}>
            {navLinks.map((link) =>
              link.label === "Coins" ? (
                <Box
                  key={link.label}
                  position="relative"
                  p="2px"
                  overflow="hidden"
                  borderRadius="4px"
                >
                  {/* Revolving conic gradient border (static on /coins) */}
                  <Box
                    position="absolute"
                    inset={isOnCoins ? "0" : "-50%"}
                    bg={
                      isOnCoins
                        ? "bauhaus.yellow"
                        : "conic-gradient(from 0deg, #F0C020, #FFE066, #F5A800, #F0C020)"
                    }
                    animation={
                      isOnCoins
                        ? undefined
                        : `${revolveBorder} 2s linear infinite`
                    }
                  />
                  <Link
                    href={getNavHref(link.href)}
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    fontSize="sm"
                    position="relative"
                    display="block"
                    bg="bauhaus.background"
                    px={3}
                    py={1}
                    borderRadius="2px"
                    _hover={{ color: "bauhaus.red" }}
                  >
                    {link.label}
                  </Link>
                </Box>
              ) : link.label === "Stake" ? (
                <Box key={link.label} position="relative">
                  {vaultData && vaultData.apr > 0 && (
                    <Box
                      position="absolute"
                      bottom="100%"
                      left="50%"
                      mb="-2px"
                      bg="bauhaus.yellow"
                      border="1.5px solid"
                      borderColor="bauhaus.black"
                      px={1.5}
                      py={0}
                      lineHeight="1.3"
                      whiteSpace="nowrap"
                    >
                      <Box
                        fontSize="8px"
                        fontWeight="900"
                        color="bauhaus.black"
                        letterSpacing="wide"
                      >
                        {vaultData.apr.toFixed(1)}% APR
                      </Box>
                    </Box>
                  )}
                  <Link
                    href={getNavHref(link.href)}
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    fontSize="sm"
                    _hover={{ color: "bauhaus.red" }}
                  >
                    {link.label}
                  </Link>
                </Box>
              ) : (
                <Link
                  key={link.label}
                  href={getNavHref(link.href)}
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  fontSize="sm"
                  _hover={{ color: "bauhaus.red" }}
                >
                  {link.label}
                </Link>
              )
            )}
          </HStack>

          {/* CTA Button */}
          <HStack spacing={4}>
            <Button
              variant="primary"
              size="md"
              as="a"
              href={CHROME_STORE_URL}
              target="_blank"
              display={{ base: "none", md: "flex" }}
            >
              Add to Chrome
            </Button>

            {/* Mobile Menu Button */}
            <IconButton
              aria-label="Open menu"
              icon={<Menu size={24} />}
              variant="ghost"
              display={{ base: "flex", md: "none" }}
              onClick={onOpen}
            />
          </HStack>
        </Flex>
      </Container>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="full">
        <DrawerOverlay />
        <DrawerContent bg="bauhaus.black">
          <DrawerCloseButton color="white" size="lg" />
          <DrawerHeader>
            <HStack spacing={2}>
              <LogoShapes size="12px" />
              <Box
                color="white"
                fontWeight="black"
                textTransform="uppercase"
                ml={2}
              >
                BANKRWALLET
              </Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={8} align="flex-start" mt={8}>
              {navLinks.map((link) =>
                link.label === "Coins" ? (
                  <Box
                    key={link.label}
                    position="relative"
                    p="2px"
                    overflow="hidden"
                    borderRadius="4px"
                  >
                    <Box
                      position="absolute"
                      inset={isOnCoins ? "0" : "-50%"}
                      bg={
                        isOnCoins
                          ? "bauhaus.yellow"
                          : "conic-gradient(from 0deg, #F0C020, #FFE066, #F5A800, #F0C020)"
                      }
                      animation={
                        isOnCoins
                          ? undefined
                          : `${revolveBorder} 2s linear infinite`
                      }
                    />
                    <Link
                      href={getNavHref(link.href)}
                      color="white"
                      fontWeight="bold"
                      fontSize="2xl"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      onClick={onClose}
                      position="relative"
                      display="block"
                      bg="bauhaus.black"
                      px={3}
                      py={1}
                      borderRadius="2px"
                      _hover={{ color: "bauhaus.yellow" }}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ) : link.label === "Stake" ? (
                  <Box key={link.label} position="relative">
                    {vaultData && vaultData.apr > 0 && (
                      <Box
                        position="absolute"
                        top="-12px"
                        left="0"
                        bg="bauhaus.yellow"
                        border="1.5px solid"
                        borderColor="bauhaus.black"
                        px={1.5}
                        py={0}
                        lineHeight="1.3"
                        whiteSpace="nowrap"
                      >
                        <Box
                          fontSize="8px"
                          fontWeight="900"
                          color="bauhaus.black"
                          letterSpacing="wide"
                        >
                          {vaultData.apr.toFixed(1)}% APR
                        </Box>
                      </Box>
                    )}
                    <Link
                      href={getNavHref(link.href)}
                      color="white"
                      fontWeight="bold"
                      fontSize="2xl"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      onClick={onClose}
                      _hover={{ color: "bauhaus.yellow" }}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ) : (
                  <Link
                    key={link.label}
                    href={getNavHref(link.href)}
                    color="white"
                    fontWeight="bold"
                    fontSize="2xl"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    onClick={onClose}
                    _hover={{ color: "bauhaus.yellow" }}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <Button
                variant="primary"
                size="lg"
                as="a"
                href={CHROME_STORE_URL}
                target="_blank"
                mt={4}
                onClick={onClose}
              >
                Add to Chrome
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
