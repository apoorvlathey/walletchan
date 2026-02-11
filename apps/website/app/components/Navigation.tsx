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

const COINS_SUBDOMAIN = "coins.bankrwallet.app";
const MAIN_SITE = "https://bankrwallet.app";

const revolveBorder = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Token", href: "#token" },
  { label: "Coins", href: "/coins" },
  // { label: "Apps", href: "/apps" },
  { label: "Install", href: "#install" },
  { label: "Tweets", href: "#tweets" },
];

export function Navigation() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const pathname = usePathname();
  const [isCoinsSubdomain, setIsCoinsSubdomain] = useState(false);

  useEffect(() => {
    setIsCoinsSubdomain(window.location.hostname === COINS_SUBDOMAIN);
  }, []);

  const isOnCoins = pathname === "/coins" || isCoinsSubdomain;

  const getNavHref = (href: string) => {
    if (isCoinsSubdomain) {
      if (href === "/coins") return "/";
      if (href.startsWith("#")) return `${MAIN_SITE}/${href}`;
    }
    return href;
  };

  const logoHref = isCoinsSubdomain ? MAIN_SITE : "/";

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
