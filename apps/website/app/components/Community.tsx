"use client";

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  SimpleGrid,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Github, ExternalLink } from "lucide-react";
import { Card } from "./ui/Card";
import { TWITTER_URL, GITHUB_URL, BANKR_API_URL } from "../constants";

const MotionBox = motion(Box);

interface SocialCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  color: "red" | "blue" | "yellow";
  delay?: number;
}

function SocialCard({
  icon,
  label,
  description,
  href,
  color,
  delay = 0,
}: SocialCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      <Card
        as="a"
        href={href}
        target="_blank"
        cursor="pointer"
        _hover={{
          textDecoration: "none",
          bg: `bauhaus.${color}`,
          color: color === "yellow" ? "bauhaus.black" : "white",
        }}
        textAlign="center"
        py={8}
      >
        <VStack spacing={4}>
          <Box
            p={4}
            border="3px solid"
            borderColor="currentColor"
            display="inline-flex"
          >
            {icon}
          </Box>
          <Text fontWeight="black" fontSize="xl" textTransform="uppercase">
            {label}
          </Text>
          <Text fontWeight="medium" fontSize="sm" color="text.secondary">
            {description}
          </Text>
        </VStack>
      </Card>
    </MotionBox>
  );
}

// Custom X (Twitter) icon
function XIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const socialLinks = [
  {
    icon: <XIcon size={32} />,
    label: "Twitter",
    description: "Follow @apoorveth for updates",
    href: TWITTER_URL,
    color: "red" as const,
  },
  {
    icon: <Github size={32} />,
    label: "GitHub",
    description: "Star the repo, contribute",
    href: GITHUB_URL,
    color: "blue" as const,
  },
  {
    icon: <ExternalLink size={32} />,
    label: "Bankr.bot",
    description: "Get your API key",
    href: BANKR_API_URL,
    color: "yellow" as const,
  },
];

export function Community() {
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  return (
    <Box bg="bauhaus.background" py={{ base: 16, md: 24 }}>
      <Container maxW="5xl">
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
                fontSize={{ base: "2xl", md: "4xl", lg: "5xl" }}
                textAlign="center"
              >
                JOIN THE COMMUNITY
              </Heading>
            </MotionBox>
            <Box w="180px" h="4px" bg="bauhaus.black" />
          </VStack>

          {/* Social Cards */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} w="full">
            {socialLinks.map((link, index) => (
              <SocialCard key={link.label} {...link} delay={index * 0.1} />
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}
