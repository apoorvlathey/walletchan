"use client";

import { Box, Text, HStack, Image } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { ExternalLink } from "lucide-react";
import { getTweetId } from "../../data/tweets";
import type { Coin } from "../hooks/useCoinsStream";

function getTweetUsername(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\//);
  return match ? match[1] : null;
}

const newCoinFade = keyframes`
  0% { background-color: #F0C020; }
  70% { background-color: #F0C020; }
  100% { background-color: white; }
`;

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

interface CoinListItemProps {
  coin: Coin;
  isNew?: boolean;
}

export function CoinListItem({ coin, isNew }: CoinListItemProps) {
  const tweetId = coin.tweetUrl ? getTweetId(coin.tweetUrl) : null;
  const username = coin.tweetUrl ? getTweetUsername(coin.tweetUrl) : null;

  return (
    <Box
      bg="white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      p={4}
      animation={isNew ? `${newCoinFade} 2.5s ease-out forwards` : undefined}
      transition="transform 0.15s, box-shadow 0.15s"
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "6px 6px 0px 0px #121212",
      }}
    >
      <HStack spacing={4}>
        <Text
          fontSize="xs"
          color="gray.400"
          fontWeight="600"
          flexShrink={0}
          minW="55px"
        >
          {getRelativeTime(coin.timestamp)}
        </Text>
        <Text
          fontWeight="900"
          fontSize="md"
          textTransform="uppercase"
          letterSpacing="wide"
          minW="100px"
          noOfLines={1}
        >
          ${coin.symbol}
        </Text>
        <Text
          fontSize="sm"
          color="gray.600"
          fontWeight="600"
          flex={1}
          noOfLines={1}
        >
          {coin.name}
        </Text>
        {tweetId && username && (
          <HStack
            as="a"
            href={`https://x.com/i/status/${tweetId}`}
            target="_blank"
            rel="noopener noreferrer"
            spacing={2}
            color="bauhaus.blue"
            fontSize="xs"
            fontWeight="700"
            _hover={{ textDecoration: "underline" }}
            flexShrink={0}
          >
            <Image
              src={`https://unavatar.io/x/${username}`}
              alt={username}
              w="20px"
              h="20px"
              borderRadius="full"
              border="1px solid"
              borderColor="gray.200"
            />
            <Text>@{username}</Text>
            <ExternalLink size={12} />
          </HStack>
        )}
      </HStack>
    </Box>
  );
}
