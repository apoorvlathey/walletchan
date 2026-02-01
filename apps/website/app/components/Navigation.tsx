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
import { Menu } from "lucide-react";
import { LogoShapes } from "./ui/GeometricShape";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Token", href: "#token" },
  { label: "Install", href: "#install" },
  { label: "Tweets", href: "#tweets" },
];

export function Navigation() {
  const { isOpen, onOpen, onClose } = useDisclosure();

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
          <Link href="/" _hover={{ textDecoration: "none" }}>
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
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wider"
                fontSize="sm"
                _hover={{ color: "bauhaus.red" }}
              >
                {link.label}
              </Link>
            ))}
          </HStack>

          {/* CTA Button */}
          <HStack spacing={4}>
            <Button
              variant="primary"
              size="md"
              as="a"
              href="#install"
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
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
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
              ))}
              <Button
                variant="primary"
                size="lg"
                as="a"
                href="#install"
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
