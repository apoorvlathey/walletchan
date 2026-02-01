"use client";

import { Box, Container, Flex, VStack, Text } from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { GeometricShape } from "./ui/GeometricShape";

const MotionText = motion(Text);

interface StatItemProps {
  value: string;
  label: string;
  shape: "circle" | "square" | "triangle";
  color: "red" | "blue" | "yellow";
}

function AnimatedNumber({ value }: { value: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    if (isInView) {
      // Extract numeric part
      const numericMatch = value.match(/(\d+)/);
      if (numericMatch) {
        const target = parseInt(numericMatch[1]);
        const prefix = value.slice(0, value.indexOf(numericMatch[1]));
        const suffix = value.slice(
          value.indexOf(numericMatch[1]) + numericMatch[1].length,
        );

        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            setDisplayValue(value);
            clearInterval(timer);
          } else {
            setDisplayValue(`${prefix}${Math.floor(current)}${suffix}`);
          }
        }, 30);

        return () => clearInterval(timer);
      } else {
        setDisplayValue(value);
      }
    }
  }, [isInView, value]);

  return (
    <MotionText
      ref={ref}
      fontSize={{ base: "xl", md: "5xl", lg: "6xl" }}
      fontWeight="black"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      {displayValue}
    </MotionText>
  );
}

function StatItem({ value, label, shape, color }: StatItemProps) {
  return (
    <VStack spacing={{ base: 1, md: 2 }} textAlign="center" flex={1}>
      <Box display={{ base: "none", md: "block" }}>
        <GeometricShape shape={shape} color={color} size="24px" />
      </Box>
      <Box display={{ base: "block", md: "none" }}>
        <GeometricShape shape={shape} color={color} size="14px" />
      </Box>
      <AnimatedNumber value={value} />
      <Text
        fontSize={{ base: "2xs", md: "sm" }}
        fontWeight="bold"
        textTransform="uppercase"
        letterSpacing={{ base: "wider", md: "widest" }}
      >
        {label}
      </Text>
    </VStack>
  );
}

export function StatsBar() {
  return (
    <Box bg="bauhaus.yellow" borderY="4px solid" borderColor="bauhaus.black">
      <Container maxW="7xl">
        <Flex
          py={{ base: 4, md: 8 }}
          px={{ base: 2, md: 0 }}
          justify="space-around"
          align="center"
          direction="row"
        >
          <StatItem
            value="4+"
            label="Chains Supported"
            shape="circle"
            color="red"
          />

          <Box
            w={{ base: "2px", md: "4px" }}
            h={{ base: "50px", md: "80px" }}
            bg="bauhaus.black"
          />

          <StatItem
            value="1000+"
            label="Token Holders"
            shape="square"
            color="blue"
          />

          <Box
            w={{ base: "2px", md: "4px" }}
            h={{ base: "50px", md: "80px" }}
            bg="bauhaus.black"
          />

          <StatItem
            value="100%"
            label="Open-Source"
            shape="triangle"
            color="red"
          />
        </Flex>
      </Container>
    </Box>
  );
}
