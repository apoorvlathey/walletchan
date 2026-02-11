"use client";

import { Box, Text, HStack, Image, Button, IconButton, Spinner, Spacer } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { ExternalLink, Zap, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { useTweet } from "react-tweet";
import { getTweetId } from "../../data/tweets";
import { VerifiedBadge } from "../../components/ui/TweetCard";
import type { Coin } from "../hooks/useCoinsStream";
import type { PoolMarketData } from "../hooks/usePoolMarketData";

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
  onBuy?: () => void;
  onInstaBuy?: () => void;
  isInstaBuying?: boolean;
  marketData?: PoolMarketData;
}

export function CoinListItem({ coin, isNew, onBuy, onInstaBuy, isInstaBuying, marketData }: CoinListItemProps) {
  const tweetId = coin.tweetUrl ? getTweetId(coin.tweetUrl) : null;
  const username = coin.tweetUrl ? getTweetUsername(coin.tweetUrl) : null;
  const { data: tweet } = useTweet(tweetId ?? undefined);
  const isVerified = tweet?.user?.is_blue_verified;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(coin.coinAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [coin.coinAddress]);

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
      {/* Desktop: single row */}
      <HStack spacing={4} display={{ base: "none", md: "flex" }}>
        <Text
          fontSize="xs"
          color="gray.400"
          fontWeight="600"
          flexShrink={0}
          minW="55px"
        >
          {getRelativeTime(coin.timestamp)}
        </Text>
        <HStack spacing={1.5} flexShrink={0}>
          <Box
            as="button"
            onClick={handleCopy}
            color={copied ? "green.500" : "gray.400"}
            _hover={{ color: copied ? "green.500" : "gray.600" }}
            display="flex"
            alignItems="center"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Box>
          <Text
            fontWeight="900"
            fontSize="md"
            textTransform="uppercase"
            letterSpacing="wide"
            noOfLines={1}
          >
            ${coin.symbol}
          </Text>
          <Text
            fontSize="sm"
            color="gray.600"
            fontWeight="600"
            noOfLines={1}
          >
            ({coin.name})
          </Text>
        </HStack>
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
            {isVerified && <VerifiedBadge size={14} />}
            <ExternalLink size={12} />
          </HStack>
        )}
        {marketData && marketData.marketCapRaw > 0 && (
          <HStack spacing={3} flexShrink={0}>
            <HStack spacing={1}>
              <Text fontSize="xs" fontWeight="800" textTransform="uppercase" color="gray.500">
                MCap:
              </Text>
              <Text fontSize="xs" fontWeight="800" color="bauhaus.blue">
                {marketData.marketCap}
              </Text>
            </HStack>
            {marketData.change5m !== null && marketData.change5m !== 0 && (
              <HStack spacing={1}>
                <Text fontSize="xs" fontWeight="800" textTransform="uppercase" color="gray.500">
                  5m:
                </Text>
                <Text
                  fontSize="xs"
                  fontWeight="800"
                  color={marketData.change5m >= 0 ? "#22c55e" : "bauhaus.red"}
                >
                  {marketData.change5m >= 0 ? "+" : ""}
                  {marketData.change5m.toFixed(2)}%
                </Text>
              </HStack>
            )}
          </HStack>
        )}
        <Spacer />
        {onBuy && (
          <HStack spacing={2} flexShrink={0}>
            {onInstaBuy && (
              <IconButton
                aria-label="Insta Buy"
                icon={isInstaBuying ? <Spinner size="xs" /> : <Zap size={12} fill="currentColor" />}
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstaBuy();
                }}
                isDisabled={isInstaBuying}
                bg="bauhaus.yellow"
                color="bauhaus.black"
                borderRadius={0}
                border="2px solid"
                borderColor="bauhaus.black"
                _hover={{ bg: "#d4a818" }}
                _disabled={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            )}
            <Button
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onBuy();
              }}
              bg="bauhaus.red"
              color="white"
              fontWeight="900"
              textTransform="uppercase"
              letterSpacing="wide"
              borderRadius={0}
              border="2px solid"
              borderColor="bauhaus.black"
              px={4}
              _hover={{ bg: "#b01a1a" }}
            >
              Buy
            </Button>
          </HStack>
        )}
      </HStack>

      {/* Mobile: stacked rows */}
      <Box display={{ base: "block", md: "none" }}>
        <Text
          fontSize="xs"
          color="gray.400"
          fontWeight="600"
        >
          {getRelativeTime(coin.timestamp)}
        </Text>
        <HStack spacing={1.5} mt={1}>
          <Box
            as="button"
            onClick={handleCopy}
            color={copied ? "green.500" : "gray.400"}
            _hover={{ color: copied ? "green.500" : "gray.600" }}
            display="flex"
            alignItems="center"
            flexShrink={0}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Box>
          <Text
            fontWeight="900"
            fontSize="md"
            textTransform="uppercase"
            letterSpacing="wide"
            noOfLines={1}
          >
            ${coin.symbol}
          </Text>
          <Text
            fontSize="sm"
            color="gray.600"
            fontWeight="600"
            noOfLines={1}
          >
            ({coin.name})
          </Text>
        </HStack>
        {tweetId && username && (
          <HStack spacing={2} mt={2}>
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
              <Text noOfLines={1}>@{username}</Text>
              {isVerified && <VerifiedBadge size={14} />}
              <ExternalLink size={12} />
            </HStack>
          </HStack>
        )}
        {marketData && marketData.marketCapRaw > 0 && (
          <HStack spacing={3} mt={2}>
            <HStack spacing={1}>
              <Text fontSize="xs" fontWeight="800" textTransform="uppercase" color="gray.500">
                MCap:
              </Text>
              <Text fontSize="xs" fontWeight="800" color="bauhaus.blue">
                {marketData.marketCap}
              </Text>
            </HStack>
            {marketData.change5m !== null && marketData.change5m !== 0 && (
              <HStack spacing={1}>
                <Text fontSize="xs" fontWeight="800" textTransform="uppercase" color="gray.500">
                  5m:
                </Text>
                <Text
                  fontSize="xs"
                  fontWeight="800"
                  color={marketData.change5m >= 0 ? "#22c55e" : "bauhaus.red"}
                >
                  {marketData.change5m >= 0 ? "+" : ""}
                  {marketData.change5m.toFixed(2)}%
                </Text>
              </HStack>
            )}
          </HStack>
        )}
        {onBuy && (
          <HStack spacing={2} mt={2} justify="center">
            {onInstaBuy && (
              <IconButton
                aria-label="Insta Buy"
                icon={isInstaBuying ? <Spinner size="xs" /> : <Zap size={12} fill="currentColor" />}
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstaBuy();
                }}
                isDisabled={isInstaBuying}
                bg="bauhaus.yellow"
                color="bauhaus.black"
                borderRadius={0}
                border="2px solid"
                borderColor="bauhaus.black"
                _hover={{ bg: "#d4a818" }}
                _disabled={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            )}
            <Button
              size="xs"
              flex={1}
              onClick={(e) => {
                e.stopPropagation();
                onBuy();
              }}
              bg="bauhaus.red"
              color="white"
              fontWeight="900"
              textTransform="uppercase"
              letterSpacing="wide"
              borderRadius={0}
              border="2px solid"
              borderColor="bauhaus.black"
              _hover={{ bg: "#b01a1a" }}
            >
              Buy
            </Button>
          </HStack>
        )}
      </Box>
    </Box>
  );
}
