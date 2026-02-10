"use client";

import {
  Box,
  HStack,
  VStack,
  Text,
  Avatar,
  Link,
  Icon,
  Skeleton,
  SkeletonCircle,
} from "@chakra-ui/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";
import { useTweet } from "react-tweet";
import { Card } from "./Card";

const MotionBox = motion(Box);

// X (Twitter) logo icon
function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Verification badge
function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 22 22" width={size} height={size} fill="#1DA1F2">
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

interface TweetCardProps {
  tweetId: string;
  decoratorColor?: "red" | "blue" | "yellow";
  decoratorShape?: "circle" | "square" | "triangle";
  delay?: number;
}

// Style to convert HDR profile images to SDR
// This tones down overly bright/saturated HDR images
const hdrToSdrStyle = {
  // Reduce brightness and saturation slightly to normalize HDR content
  filter: "saturate(0.85) brightness(0.92) contrast(1.05)",
  // Ensure the image uses sRGB color space
  imageRendering: "auto" as const,
};

// Format date like Twitter
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Loading skeleton
function TweetCardSkeleton({
  decoratorColor = "blue",
  decoratorShape = "circle",
}: {
  decoratorColor?: "red" | "blue" | "yellow";
  decoratorShape?: "circle" | "square" | "triangle";
}) {
  return (
    <Card
      decoratorColor={decoratorColor}
      decoratorShape={decoratorShape}
      p={{ base: 4, md: 6 }}
    >
      <VStack align="stretch" spacing={4}>
        <HStack spacing={3}>
          <SkeletonCircle size="12" />
          <VStack align="flex-start" spacing={1}>
            <Skeleton height="14px" width="120px" />
            <Skeleton height="12px" width="80px" />
          </VStack>
        </HStack>
        <Skeleton height="16px" width="100%" />
        <Skeleton height="16px" width="90%" />
        <Skeleton height="16px" width="70%" />
        <Skeleton height="12px" width="100px" />
      </VStack>
    </Card>
  );
}

// Helper to remove leading @mentions (reply indicators) from tweet text
function removeLeadingMentions(text: string): string {
  // Match @username patterns at the start of the text (with optional spaces between them)
  // This handles: "@user1 @user2 actual tweet content"
  return text.replace(/^(@\w+\s*)+/, "").trim();
}

// Helper to render text with clickable cashtags and URLs
function renderTextWithLinks(
  text: string,
  urlMap: Map<string, string>,
): React.ReactNode {
  // Combined regex for cashtags and display URLs
  // Match cashtags ($WORD) or any URL-like patterns from our urlMap
  const displayUrls = Array.from(urlMap.keys());

  if (displayUrls.length === 0) {
    // No URLs, just handle cashtags
    const cashtagRegex = /(\$[A-Za-z][A-Za-z0-9]*)/g;
    const parts = text.split(cashtagRegex);

    if (parts.length === 1) {
      return text;
    }

    return parts.map((part, index) => {
      if (part.match(cashtagRegex)) {
        const encodedCashtag = encodeURIComponent(part);
        return (
          <Link
            key={index}
            href={`https://x.com/search?q=${encodedCashtag}&src=cashtag_click`}
            isExternal
            color="bauhaus.blue"
            fontWeight="semibold"
            _hover={{ textDecoration: "underline" }}
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  }

  // Escape special regex chars in display URLs and create combined pattern
  const escapedUrls = displayUrls.map((url) =>
    url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const combinedPattern = new RegExp(
    `(\\$[A-Za-z][A-Za-z0-9]*|${escapedUrls.join("|")})`,
    "g",
  );

  const parts = text.split(combinedPattern);

  return parts.map((part, index) => {
    // Check if it's a cashtag
    if (part.match(/^\$[A-Za-z][A-Za-z0-9]*$/)) {
      const encodedCashtag = encodeURIComponent(part);
      return (
        <Link
          key={index}
          href={`https://x.com/search?q=${encodedCashtag}&src=cashtag_click`}
          isExternal
          color="bauhaus.blue"
          fontWeight="semibold"
          _hover={{ textDecoration: "underline" }}
        >
          {part}
        </Link>
      );
    }

    // Check if it's a URL from our map
    if (urlMap.has(part)) {
      return (
        <Link
          key={index}
          href={urlMap.get(part)!}
          isExternal
          color="bauhaus.blue"
          _hover={{ textDecoration: "underline" }}
        >
          {part}
        </Link>
      );
    }

    return part;
  });
}

// Helper to process tweet text - replaces t.co URLs with expanded URLs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processTweetText(text: string, entities?: any): React.ReactNode {
  let result = text;
  // Map of display_url -> expanded_url for making links clickable
  const urlMap = new Map<string, string>();

  if (!entities?.urls || entities.urls.length === 0) {
    // No URL entities - just remove media t.co URLs
    const mediaUrls = entities?.media?.map((m: { url: string }) => m.url) || [];
    mediaUrls.forEach((url: string) => {
      result = result.replace(url, "");
    });
  } else {
    // Sort URLs by their position in text (indices) in reverse order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedUrls = [...entities.urls].sort(
      (a: any, b: any) => (b.indices?.[0] || 0) - (a.indices?.[0] || 0),
    );

    // Also get media URLs to remove (these are just for media embeds)
    const mediaUrls = new Set<string>(
      entities?.media?.map((m: { url: string }) => m.url) || [],
    );

    // Replace each t.co URL with its display URL and build the URL map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sortedUrls.forEach((urlEntity: any) => {
      const { url, display_url, expanded_url } = urlEntity;
      if (url && display_url) {
        // Skip media URLs (they'll be shown as embedded media)
        if (mediaUrls.has(url)) {
          result = result.replace(url, "");
        } else {
          // Replace with the display URL and store mapping
          result = result.replace(url, display_url);
          urlMap.set(display_url, expanded_url || url);
        }
      }
    });

    // Remove any remaining media t.co URLs
    mediaUrls.forEach((url: string) => {
      result = result.replace(url, "");
    });
  }

  // Remove leading @mentions (reply indicators like "@user1 @user2 ...")
  result = removeLeadingMentions(result);

  // Convert cashtags and URLs to clickable links and return
  return renderTextWithLinks(result.trim(), urlMap);
}

// Quoted Tweet Card component
function QuotedTweetCardContent({
  tweet,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tweet: any;
}) {
  const quotedTweetUrl = `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
  const processedText = processTweetText(tweet.text, tweet.entities);

  // Get media from quoted tweet
  const photos = tweet.photos;
  const video = tweet.video;

  return (
    <Link
      href={quotedTweetUrl}
      isExternal
      _hover={{ textDecoration: "none" }}
      display="block"
    >
      <Box
        border="2px solid"
        borderColor="bauhaus.black"
        bg="gray.100"
        overflow="hidden"
        transition="all 0.2s ease-out"
        _hover={{
          bg: "gray.200",
        }}
      >
        {/* Quoted Tweet Header & Content */}
        <Box p={4}>
          <HStack spacing={2} mb={2}>
            <Avatar
              size="xs"
              name={tweet.user.name}
              src={tweet.user.profile_image_url_https}
              bg="bauhaus.blue"
              color="white"
              sx={{
                ...hdrToSdrStyle,
                border: "2px solid var(--chakra-colors-bauhaus-black)",
                boxShadow: "2px 2px 0px 0px #121212",
              }}
            />
            <HStack spacing={1}>
              <Text fontWeight="bold" fontSize="xs" color="bauhaus.black">
                {tweet.user.name}
              </Text>
              {tweet.user.is_blue_verified && <VerifiedBadge size={14} />}
            </HStack>
            <Text color="gray.500" fontSize="xs">
              @{tweet.user.screen_name}
            </Text>
          </HStack>

          {/* Quoted Tweet Content */}
          {processedText && (
            <Text
              fontSize="sm"
              color="bauhaus.black"
              lineHeight="1.4"
              whiteSpace="pre-wrap"
              noOfLines={4}
            >
              {processedText}
            </Text>
          )}
        </Box>

        {/* Quoted Tweet Media */}
        {photos && photos.length > 0 && (
          <Box borderTop="2px solid" borderColor="bauhaus.black">
            <Box
              as="img"
              src={photos[0].url}
              alt="Tweet media"
              w="full"
              maxH="200px"
              objectFit="cover"
            />
          </Box>
        )}

        {/* Quoted Tweet Video Poster */}
        {video && !photos?.length && (
          <Box
            borderTop="2px solid"
            borderColor="bauhaus.black"
            position="relative"
          >
            <Box
              as="img"
              src={video.poster}
              alt="Video thumbnail"
              w="full"
              maxH="200px"
              objectFit="cover"
            />
            {/* Play button overlay */}
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w={12}
              h={12}
              bg="bauhaus.black"
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Box
                as="svg"
                viewBox="0 0 24 24"
                w={5}
                h={5}
                fill="white"
                transform="translateX(1px)"
              >
                <path d="M8 5v14l11-7z" />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Link>
  );
}

/**
 * Lightweight tweet embed without Card/MotionBox wrapper.
 * Used to embed tweet content inside other cards (e.g. CoinCard).
 */
export function TweetEmbed({ tweetId, hideQuotedTweet }: { tweetId: string; hideQuotedTweet?: boolean }) {
  const { data: tweet, isLoading, error } = useTweet(tweetId);

  if (isLoading) {
    return (
      <VStack align="stretch" spacing={3}>
        <HStack spacing={2}>
          <SkeletonCircle size="8" />
          <VStack align="flex-start" spacing={1}>
            <Skeleton height="12px" width="100px" />
            <Skeleton height="10px" width="70px" />
          </VStack>
        </HStack>
        <Skeleton height="14px" width="100%" />
        <Skeleton height="14px" width="80%" />
      </VStack>
    );
  }

  if (error || !tweet) {
    return (
      <Text color="gray.400" fontSize="xs">
        Tweet unavailable
      </Text>
    );
  }

  const tweetUrl = `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
  const quotedTweet = tweet.quoted_tweet;

  return (
    <VStack align="stretch" spacing={3}>
      {/* Author */}
      <HStack justify="space-between">
        <HStack spacing={2}>
          <Link href={`https://x.com/${tweet.user.screen_name}`} isExternal>
            <Avatar
              size="xs"
              name={tweet.user.name}
              src={tweet.user.profile_image_url_https}
              bg="bauhaus.blue"
              color="white"
              sx={{
                ...hdrToSdrStyle,
                border: "2px solid var(--chakra-colors-bauhaus-black)",
                boxShadow: "2px 2px 0px 0px #121212",
              }}
            />
          </Link>
          <VStack align="flex-start" spacing={0}>
            <HStack spacing={1}>
              <Link
                href={`https://x.com/${tweet.user.screen_name}`}
                isExternal
                _hover={{ textDecoration: "none" }}
              >
                <Text fontWeight="bold" fontSize="xs" color="bauhaus.black">
                  {tweet.user.name}
                </Text>
              </Link>
              {tweet.user.is_blue_verified && <VerifiedBadge size={14} />}
            </HStack>
            <Text color="gray.500" fontSize="2xs">
              @{tweet.user.screen_name}
            </Text>
          </VStack>
        </HStack>
        <Link
          href={tweetUrl}
          isExternal
          color="bauhaus.black"
          _hover={{ color: "bauhaus.blue" }}
          transition="color 0.2s"
        >
          <XIcon size={16} />
        </Link>
      </HStack>

      {/* Tweet text */}
      <Text
        fontSize="sm"
        fontWeight="medium"
        color="bauhaus.black"
        lineHeight="1.4"
        whiteSpace="pre-wrap"
        noOfLines={6}
      >
        {processTweetText(tweet.text, tweet.entities)}
      </Text>

      {/* Quoted Tweet */}
      {quotedTweet && !hideQuotedTweet && <QuotedTweetCardContent tweet={quotedTweet} />}

      {/* Media */}
      {tweet.photos && tweet.photos.length > 0 && (
        <Box
          overflow="hidden"
          border="2px solid"
          borderColor="bauhaus.black"
        >
          <Box
            as="img"
            src={tweet.photos[0].url}
            alt="Tweet media"
            w="full"
            maxH="200px"
            objectFit="cover"
          />
        </Box>
      )}

      {/* Footer */}
      <HStack
        justify="space-between"
        pt={2}
        borderTop="2px solid"
        borderColor="bauhaus.black"
      >
        <Link
          href={tweetUrl}
          isExternal
          fontSize="2xs"
          color="gray.500"
          _hover={{ color: "bauhaus.blue", textDecoration: "underline" }}
        >
          {formatDate(tweet.created_at)}
        </Link>
        <Link
          href={tweetUrl}
          isExternal
          display="flex"
          alignItems="center"
          gap={1}
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
          fontSize="2xs"
          color="bauhaus.black"
          _hover={{ color: "bauhaus.blue" }}
          transition="color 0.2s"
        >
          <Text>View on X</Text>
          <Icon as={ExternalLink} boxSize={2.5} />
        </Link>
      </HStack>
    </VStack>
  );
}

export function TweetCard({
  tweetId,
  decoratorColor = "blue",
  decoratorShape = "circle",
  delay = 0,
}: TweetCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const { data: tweet, isLoading, error } = useTweet(tweetId);

  if (isLoading) {
    return (
      <MotionBox
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay }}
      >
        <TweetCardSkeleton
          decoratorColor={decoratorColor}
          decoratorShape={decoratorShape}
        />
      </MotionBox>
    );
  }

  if (error || !tweet) {
    return (
      <MotionBox
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay }}
      >
        <Card
          decoratorColor={decoratorColor}
          decoratorShape={decoratorShape}
          p={{ base: 4, md: 6 }}
        >
          <Text color="gray.500" textAlign="center">
            Tweet unavailable
          </Text>
        </Card>
      </MotionBox>
    );
  }

  const tweetUrl = `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`;

  // Check for quoted tweet
  const quotedTweet = tweet.quoted_tweet;

  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      <Card
        decoratorColor={decoratorColor}
        decoratorShape={decoratorShape}
        role="group"
        p={{ base: 4, md: 6 }}
      >
        <VStack align="stretch" spacing={4}>
          {/* Header - Author & X Logo */}
          <HStack justify="space-between" align="flex-start">
            <HStack spacing={3}>
              <Link href={`https://x.com/${tweet.user.screen_name}`} isExternal>
                <Avatar
                  size="md"
                  name={tweet.user.name}
                  src={tweet.user.profile_image_url_https}
                  bg="bauhaus.red"
                  color="white"
                  sx={{
                    ...hdrToSdrStyle,
                    border: "3px solid var(--chakra-colors-bauhaus-black)",
                    boxShadow: "4px 4px 0px 0px #121212",
                  }}
                />
              </Link>
              <VStack align="flex-start" spacing={0}>
                <HStack spacing={1}>
                  <Link
                    href={`https://x.com/${tweet.user.screen_name}`}
                    isExternal
                    _hover={{ textDecoration: "none" }}
                  >
                    <Text
                      fontWeight="bold"
                      fontSize="sm"
                      color="bauhaus.black"
                      _groupHover={{ color: "bauhaus.blue" }}
                      transition="color 0.2s"
                    >
                      {tweet.user.name}
                    </Text>
                  </Link>
                  {tweet.user.is_blue_verified && <VerifiedBadge />}
                </HStack>
                <Text color="gray.500" fontSize="xs">
                  @{tweet.user.screen_name}
                </Text>
              </VStack>
            </HStack>

            {/* X Logo - links to tweet */}
            <Link
              href={tweetUrl}
              isExternal
              color="bauhaus.black"
              _hover={{ color: "bauhaus.blue" }}
              transition="color 0.2s"
            >
              <XIcon size={22} />
            </Link>
          </HStack>

          {/* Tweet Content */}
          <Text
            fontSize={{ base: "sm", md: "md" }}
            fontWeight="medium"
            color="bauhaus.black"
            lineHeight="1.5"
            whiteSpace="pre-wrap"
          >
            {processTweetText(tweet.text, tweet.entities)}
          </Text>

          {/* Quoted Tweet */}
          {quotedTweet && <QuotedTweetCardContent tweet={quotedTweet} />}

          {/* Media (if any) */}
          {tweet.photos && tweet.photos.length > 0 && (
            <Box
              borderRadius="none"
              overflow="hidden"
              border="2px solid"
              borderColor="bauhaus.black"
            >
              <Box
                as="img"
                src={tweet.photos[0].url}
                alt="Tweet media"
                w="full"
                maxH="300px"
                objectFit="cover"
              />
            </Box>
          )}

          {/* Timestamp & View Link */}
          <HStack
            justify="space-between"
            pt={3}
            borderTop="2px solid"
            borderColor="bauhaus.black"
          >
            <Link
              href={tweetUrl}
              isExternal
              fontSize="xs"
              color="gray.500"
              _hover={{ color: "bauhaus.blue", textDecoration: "underline" }}
            >
              {formatDate(tweet.created_at)}
            </Link>

            {/* View on X */}
            <Link
              href={tweetUrl}
              isExternal
              display="flex"
              alignItems="center"
              gap={1}
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="wider"
              fontSize="xs"
              color="bauhaus.black"
              _hover={{ color: "bauhaus.blue" }}
              transition="color 0.2s"
            >
              <Text>View on X</Text>
              <Icon as={ExternalLink} boxSize={3} />
            </Link>
          </HStack>
        </VStack>
      </Card>
    </MotionBox>
  );
}
