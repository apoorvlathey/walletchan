"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Image,
  Flex,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const MotionBox = motion(Box);

interface ScreenshotProps {
  src: string;
  alt: string;
  label: string;
  rotation: number;
  featured?: boolean;
  delay?: number;
}

function Screenshot({
  src,
  alt,
  label,
  rotation,
  featured = false,
  delay = 0,
}: ScreenshotProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y: 30, rotate: 0 }}
      animate={isInView ? { opacity: 1, y: 0, rotate: rotation } : {}}
      whileHover={{ rotate: 0, scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.4, delay }}
    >
      <VStack spacing={3}>
        <Box
          border="4px solid"
          borderColor="bauhaus.black"
          boxShadow="8px 8px 0px 0px #121212"
          bg="white"
          overflow="hidden"
          position="relative"
        >
          <Image
            src={src}
            alt={alt}
            w={{
              base: featured ? "250px" : "180px",
              md: featured ? "320px" : "220px",
            }}
            transition="filter 0.3s"
            _groupHover={{ filter: "grayscale(0)" }}
          />
        </Box>
        <Text
          color="white"
          fontWeight="bold"
          fontSize="sm"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {label}
        </Text>
      </VStack>
    </MotionBox>
  );
}

const screenshots = [
  {
    src: "/screenshots/password-page.png",
    alt: "Unlock Screen",
    label: "Unlock Screen",
    rotation: -2,
  },
  {
    src: "/screenshots/homepage-new.png",
    alt: "Homepage",
    label: "Homepage",
    rotation: 1,
  },
  {
    src: "/screenshots/settings.png",
    alt: "Settings",
    label: "Settings",
    rotation: -1,
  },
];

export function Screenshots() {
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  return (
    <Box
      bg="bauhaus.red"
      py={{ base: 16, md: 24 }}
      position="relative"
      overflow="hidden"
    >
      {/* Background decoration */}
      <Box
        position="absolute"
        bottom="-80px"
        left="-80px"
        w="250px"
        h="250px"
        border="20px solid"
        borderColor="whiteAlpha.200"
        borderRadius="full"
      />

      <Container maxW="7xl">
        <VStack spacing={{ base: 12, md: 16 }}>
          {/* Section Header */}
          <VStack spacing={4} ref={headingRef}>
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <Heading
                as="h2"
                fontSize={{ base: "3xl", md: "5xl" }}
                color="white"
                textAlign="center"
              >
                SEE IT IN ACTION
              </Heading>
            </MotionBox>
            <Box w="160px" h="4px" bg="white" />
          </VStack>

          {/* Screenshots Grid - Top Row */}
          <Flex
            gap={{ base: 6, md: 10 }}
            justify="center"
            flexWrap="wrap"
            role="group"
          >
            {screenshots.map((screenshot, index) => (
              <Screenshot
                key={screenshot.alt}
                {...screenshot}
                delay={index * 0.1}
              />
            ))}
          </Flex>

          {/* Featured Screenshot - Transaction Request */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <VStack spacing={3}>
              <Box
                border="4px solid"
                borderColor="bauhaus.black"
                boxShadow="12px 12px 0px 0px #121212"
                bg="white"
                overflow="hidden"
              >
                <Image
                  src="/screenshots/tx-request.png"
                  alt="Transaction Request"
                  w={{ base: "490px", md: "700px" }}
                />
              </Box>
              <Text
                color="white"
                fontWeight="bold"
                fontSize="md"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Transaction Request
              </Text>
            </VStack>
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
}
