"use client";

import { Box, Text, HStack, VStack, Image } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { Card } from "../../components/ui/Card";
import { TweetEmbed } from "../../components/ui/TweetCard";
import { getTweetId } from "../../data/tweets";
import type { Coin } from "../hooks/useCoinsStream";
import { useState, useEffect } from "react";

const newCoinFade = keyframes`
  0% { background-color: #F0C020; }
  70% { background-color: #F0C020; }
  100% { background-color: white; }
`;

const DECORATOR_COLORS = ["red", "blue", "yellow"] as const;
const DECORATOR_SHAPES = ["circle", "square", "triangle"] as const;

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = Number(timestamp) * 1000;
  const diff = Math.max(0, now - then);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface TokenURIMetadata {
  image?: string;
  name?: string;
}

function useTokenImage(tokenURI: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenURI) return;

    let cancelled = false;

    async function fetchMetadata() {
      try {
        const res = await fetch(tokenURI!);
        if (!res.ok || cancelled) return;
        const data: TokenURIMetadata = await res.json();
        if (!cancelled && data.image) {
          setImageUrl(data.image);
        }
      } catch {
        // Ignore fetch errors for token metadata
      }
    }

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [tokenURI]);

  return imageUrl;
}

interface CoinCardProps {
  coin: Coin;
  index: number;
  isNew?: boolean;
}

export function CoinCard({ coin, index, isNew }: CoinCardProps) {
  const colorIndex = index % DECORATOR_COLORS.length;
  const shapeIndex = index % DECORATOR_SHAPES.length;
  const imageUrl = useTokenImage(coin.tokenURI);
  const tweetId = coin.tweetUrl ? getTweetId(coin.tweetUrl) : null;

  return (
      <Card
        decoratorColor={DECORATOR_COLORS[colorIndex]}
        decoratorShape={DECORATOR_SHAPES[shapeIndex]}
        animation={isNew ? `${newCoinFade} 2.5s ease-out forwards` : undefined}
        h="full"
        display="flex"
        flexDirection="column"
      >
        {/* Coin image + ticker + name */}
        <HStack spacing={3}>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={coin.name}
              w="40px"
              h="40px"
              border="2px solid"
              borderColor="bauhaus.black"
              objectFit="cover"
            />
          )}
          <VStack align="flex-start" spacing={0} flex={1}>
            <Text
              fontWeight="900"
              fontSize="lg"
              textTransform="uppercase"
              letterSpacing="wide"
              lineHeight="1.2"
            >
              ${coin.symbol}
            </Text>
            <Text
              fontSize="sm"
              color="gray.600"
              fontWeight="600"
              noOfLines={1}
            >
              {coin.name}
            </Text>
          </VStack>
          <Text fontSize="xs" color="gray.400" fontWeight="600">
            {getRelativeTime(coin.timestamp)}
          </Text>
        </HStack>

        {/* Embedded tweet */}
        {tweetId && (
          <Box
            mt={3}
            mx={-6}
            mb={-6}
            px={5}
            py={4}
            flex={1}
            bg="blue.50"
            borderTop="2px solid"
            borderColor="bauhaus.black"
          >
            <TweetEmbed tweetId={tweetId} hideQuotedTweet />
          </Box>
        )}
      </Card>
  );
}
