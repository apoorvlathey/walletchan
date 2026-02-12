"use client";

import { Box, Text, HStack, VStack, Button, IconButton, Spinner } from "@chakra-ui/react";
import { Zap, Copy, Check } from "lucide-react";
import { keyframes } from "@emotion/react";
import { Card } from "../../components/ui/Card";
import { TweetEmbed } from "../../components/ui/TweetCard";
import { getTweetId } from "../../data/tweets";
import type { Coin } from "../hooks/useCoinsStream";
import type { PoolMarketData } from "../hooks/usePoolMarketData";
import { useTweetUrl } from "../hooks/useTweetUrl";
import { useState, useCallback } from "react";

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

interface CoinCardProps {
  coin: Coin;
  index: number;
  isNew?: boolean;
  onBuy?: () => void;
  onInstaBuy?: () => void;
  isInstaBuying?: boolean;
  marketData?: PoolMarketData;
}

export function CoinCard({ coin, index, isNew, onBuy, onInstaBuy, isInstaBuying, marketData }: CoinCardProps) {
  const colorIndex = index % DECORATOR_COLORS.length;
  const shapeIndex = index % DECORATOR_SHAPES.length;
  const tweetUrl = useTweetUrl(coin.tokenURI, coin.tweetUrl);
  const tweetId = tweetUrl ? getTweetId(tweetUrl) : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(coin.coinAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [coin.coinAddress]);

  return (
      <Card
        decoratorColor={DECORATOR_COLORS[colorIndex]}
        decoratorShape={DECORATOR_SHAPES[shapeIndex]}
        animation={isNew ? `${newCoinFade} 2.5s ease-out forwards` : undefined}
        h="full"
        display="flex"
        flexDirection="column"
      >
        {/* Coin ticker + name */}
        <HStack spacing={3}>
          <VStack align="flex-start" spacing={0} flex={1} minW={0}>
            <HStack spacing={1.5} w="full">
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
                fontSize="lg"
                textTransform="uppercase"
                letterSpacing="wide"
                lineHeight="1.2"
                noOfLines={1}
                flex={1}
                minW={0}
              >
                ${coin.symbol}
              </Text>
              <Text fontSize="xs" color="gray.400" fontWeight="600" flexShrink={0}>
                {getRelativeTime(coin.timestamp)}
              </Text>
            </HStack>
            <Text
              fontSize="sm"
              color="gray.600"
              fontWeight="600"
              noOfLines={1}
              w="full"
            >
              {coin.name}
            </Text>
          </VStack>
        </HStack>

        {/* Market data — only show when there's a real mcap value */}
        {marketData && marketData.marketCapRaw > 0 && (
          <HStack spacing={2} mt={2} justify="space-between">
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

        {/* Buy buttons */}
        {onBuy && (
          <HStack spacing={2} mt={3} w="full">
            {onInstaBuy && (
              <IconButton
                aria-label="Insta Buy"
                icon={isInstaBuying ? <Spinner size="xs" /> : <Zap size={16} fill="currentColor" />}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstaBuy();
                }}
                isDisabled={isInstaBuying}
                bg="bauhaus.yellow"
                color="bauhaus.black"
                fontWeight="900"
                borderRadius={0}
                border="2px solid"
                borderColor="bauhaus.black"
                _hover={{ bg: "#d4a818" }}
                _disabled={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            )}
            <Button
              size="sm"
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

        {/* Embedded tweet */}
        {tweetId && (
          <Box
            mt={3}
            mx={-6}
            mb={-6}
            px={5}
            py={4}
            bg="blue.50"
            borderTop="2px solid"
            borderColor="bauhaus.black"
            flex={1}
          >
            <TweetEmbed tweetId={tweetId} hideQuotedTweet />
          </Box>
        )}
      </Card>
  );
}
