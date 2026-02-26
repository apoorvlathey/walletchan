"use client";

import { Box, Container, Heading, VStack, Button } from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";
import { TweetCard } from "./ui/TweetCard";
import { tweets, getTweetId } from "../data/tweets";

const MotionBox = motion(Box);

const DECORATOR_COLORS = ["blue", "red", "yellow"] as const;
const DECORATOR_SHAPES = ["circle", "square", "triangle"] as const;

export function TweetGrid() {
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true });

  return (
    <Box
      id="tweets"
      bg="bauhaus.background"
      pt={{ base: 16, md: 24 }}
      pb={{ base: 10, md: 14 }}
    >
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
                fontSize={{ base: "2xl", md: "4xl", lg: "5xl" }}
                textAlign="center"
              >
                WHAT PEOPLE ARE SAYING
              </Heading>
            </MotionBox>
            <Box w="200px" h="4px" bg="bauhaus.black" />
          </VStack>

          {/* Bento Grid Layout - 3 columns masonry style */}
          <Box
            w="full"
            maxW="6xl"
            mx="auto"
            sx={{
              columnCount: { base: 1, md: 2, lg: 3 },
              columnGap: "1.5rem",
            }}
          >
            {tweets.map((tweetUrl, index) => (
              <Box
                key={getTweetId(tweetUrl)}
                mb={6}
                sx={{
                  breakInside: "avoid",
                }}
              >
                <TweetCard
                  tweetId={getTweetId(tweetUrl)}
                  decoratorColor={
                    DECORATOR_COLORS[index % DECORATOR_COLORS.length]
                  }
                  decoratorShape={
                    DECORATOR_SHAPES[index % DECORATOR_SHAPES.length]
                  }
                  delay={0.1 * (index + 1)}
                />
              </Box>
            ))}
          </Box>

          {/* CTA */}
          <Button
            variant="outline"
            size="lg"
            as="a"
            href="https://x.com/search?q=%24WCHAN&src=cashtag_click"
            target="_blank"
            rightIcon={<ExternalLink size={18} />}
          >
            See More on X
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}
