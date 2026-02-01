"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  List,
  ListItem,
  Link,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GeometricShape } from "./ui/GeometricShape";

const MotionBox = motion(Box);

interface RoadmapItemProps {
  version: string;
  title: string;
  items: string[];
  shape: "circle" | "square" | "triangle";
  color: "red" | "blue" | "yellow";
  filled: boolean;
  githubUrl?: string;
  delay?: number;
}

function RoadmapItem({
  version,
  title,
  items,
  shape,
  color,
  filled,
  githubUrl,
  delay = 0,
}: RoadmapItemProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      <HStack align="flex-start" spacing={6}>
        {/* Timeline marker */}
        <VStack spacing={0}>
          <Box
            p={3}
            border="3px solid"
            borderColor="bauhaus.black"
            bg={filled ? `bauhaus.${color}` : "transparent"}
          >
            <GeometricShape
              shape={shape}
              color={filled ? "yellow" : color}
              size="20px"
              filled={filled}
            />
          </Box>
          <Box w="3px" h="80px" bg="bauhaus.black" opacity={0.3} />
        </VStack>

        {/* Content */}
        <VStack align="flex-start" spacing={2} pb={8}>
          <HStack spacing={3}>
            {githubUrl ? (
              <Link
                href={githubUrl}
                target="_blank"
                fontWeight="black"
                fontSize={{ base: "lg", md: "xl" }}
                _hover={{ color: "bauhaus.red", textDecoration: "underline" }}
              >
                {version}
              </Link>
            ) : (
              <Text fontWeight="black" fontSize={{ base: "lg", md: "xl" }}>
                {version}
              </Text>
            )}
            <Text
              fontWeight="bold"
              color="text.secondary"
              fontSize={{ base: "md", md: "lg" }}
            >
              - {title}
            </Text>
          </HStack>
          <List spacing={1}>
            {items.map((item) => (
              <ListItem
                key={item}
                fontWeight="medium"
                color="text.secondary"
                fontSize="sm"
                pl={2}
                _before={{
                  content: '"•"',
                  mr: 2,
                  color: `bauhaus.${color}`,
                  fontWeight: "black",
                }}
              >
                {item}
              </ListItem>
            ))}
          </List>
        </VStack>
      </HStack>
    </MotionBox>
  );
}

const roadmapItems: RoadmapItemProps[] = [
  {
    version: "v0.1.0",
    title: "Initial Release",
    items: [
      "Transaction execution through Bankr API",
      "Multi-chain support (Base, ETH, Polygon, Unichain)",
      "Side panel mode",
      "Secure encrypted storage",
    ],
    shape: "square",
    color: "red",
    filled: true,
    githubUrl:
      "https://github.com/apoorvlathey/bankr-wallet/releases/tag/v0.1.0",
  },
  {
    version: "v0.2.0",
    title: "Coming Soon",
    items: [
      "Token holdings view",
      "Chat interface for Bankr prompts",
      "Custom themes",
      "Improved transaction history",
    ],
    shape: "circle",
    color: "blue",
    filled: false,
  },
  {
    version: "Future",
    title: "On the Horizon",
    items: [
      "WalletConnect integration",
      "Governance voting",
      "In-wallet swaps",
      "Mobile companion app",
    ],
    shape: "triangle",
    color: "yellow",
    filled: false,
  },
];

export function Roadmap() {
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  return (
    <Box
      bg="bauhaus.yellow"
      py={{ base: 16, md: 24 }}
      borderY="4px solid"
      borderColor="bauhaus.black"
    >
      <Container maxW="4xl">
        <VStack spacing={{ base: 12, md: 16 }} align="flex-start">
          {/* Section Header */}
          <VStack spacing={4} ref={headingRef} w="full" align="center">
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <Heading
                as="h2"
                fontSize={{ base: "3xl", md: "5xl" }}
                textAlign="center"
              >
                SHIP LOG
              </Heading>
            </MotionBox>
            <Box w="100px" h="4px" bg="bauhaus.black" />
          </VStack>

          {/* Timeline */}
          <VStack align="flex-start" spacing={0} w="full" pl={{ base: 2, md: 8 }}>
            {roadmapItems.map((item, index) => (
              <RoadmapItem key={item.version} {...item} delay={index * 0.15} />
            ))}
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
