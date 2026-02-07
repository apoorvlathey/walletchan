import { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Image,
  Skeleton,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { RepeatIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { fetchPortfolio, PortfolioToken } from "@/chrome/portfolioApi";
import { getChainConfig } from "@/constants/chainConfig";

interface TokenHoldingsProps {
  address: string;
  onTokenClick?: (token: PortfolioToken) => void;
  hideHeader?: boolean;
  hideCard?: boolean;
  onStateChange?: (state: {
    totalValueUsd: number;
    loading: boolean;
    hideValue: boolean;
    toggleHideValue: () => void;
    refresh: () => void;
  }) => void;
}

function TokenHoldings({ address, onTokenClick, hideHeader, hideCard, onStateChange }: TokenHoldingsProps) {
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [totalValueUsd, setTotalValueUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideValue, setHideValue] = useState(false);
  const [lastFetched, setLastFetched] = useState(0);

  // Load hide preference
  useEffect(() => {
    chrome.storage.sync.get("hidePortfolioValue", (result) => {
      if (result.hidePortfolioValue) setHideValue(true);
    });
  }, []);

  const toggleHideValue = () => {
    const newVal = !hideValue;
    setHideValue(newVal);
    chrome.storage.sync.set({ hidePortfolioValue: newVal });
  };

  // Stable refs for callbacks to avoid triggering effect on every render
  const toggleHideValueRef = useRef(toggleHideValue);
  toggleHideValueRef.current = toggleHideValue;

  const loadPortfolio = useCallback(
    async (force = false) => {
      if (!address) return;
      // Cache for 60s unless forced
      if (!force && Date.now() - lastFetched < 60_000 && tokens.length > 0) return;

      setLoading(true);
      setError(null);

      try {
        const data = await fetchPortfolio(address);
        setTokens(data.tokens);
        setTotalValueUsd(data.totalValueUsd);
        setLastFetched(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load portfolio");
      } finally {
        setLoading(false);
      }
    },
    [address, lastFetched, tokens.length]
  );

  // Reset cache and reload when address changes
  useEffect(() => {
    setLastFetched(0);
    setTokens([]);
    setTotalValueUsd(0);
    loadPortfolio(true);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of state changes for tab header display
  const loadPortfolioRef = useRef(loadPortfolio);
  loadPortfolioRef.current = loadPortfolio;

  useEffect(() => {
    onStateChange?.({
      totalValueUsd,
      loading,
      hideValue,
      toggleHideValue: () => toggleHideValueRef.current(),
      refresh: () => loadPortfolioRef.current(true),
    });
  }, [totalValueUsd, loading, hideValue, onStateChange]);

  const formatUsd = (value: number): string => {
    if (hideValue) return "****";
    if (value === 0) return "$0.00";
    if (value < 0.01) return "<$0.01";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (error && tokens.length === 0) {
    const errorContent = (
      <HStack justify="space-between" p={hideCard ? 0 : 3}>
        <Text fontSize="sm" color="text.tertiary" fontWeight="700">
          Portfolio unavailable
        </Text>
        <IconButton
          aria-label="Retry"
          icon={<RepeatIcon />}
          size="xs"
          variant="ghost"
          onClick={() => loadPortfolio(true)}
        />
      </HStack>
    );
    if (hideCard) return errorContent;
    return (
      <Box
        bg="bauhaus.white"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        p={0}
      >
        <Box p={3}>{errorContent}</Box>
      </Box>
    );
  }

  const tokenList = (
    <VStack
      spacing={0}
      maxH={hideCard ? undefined : "200px"}
      overflowY="auto"
      css={{
        "&::-webkit-scrollbar": { width: "6px" },
        "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
        "&::-webkit-scrollbar-thumb": { background: "#121212" },
      }}
    >
      {loading && tokens.length === 0 ? (
        // Loading skeletons
        Array.from({ length: 3 }).map((_, i) => (
          <HStack key={i} w="full" p={2.5} px={3} borderBottom="1px solid" borderColor="gray.200">
            <Skeleton boxSize="24px" borderRadius="sm" />
            <VStack align="start" spacing={0} flex={1}>
              <Skeleton h="14px" w="60px" />
              <Skeleton h="12px" w="40px" mt={1} />
            </VStack>
            <VStack align="end" spacing={0}>
              <Skeleton h="14px" w="50px" />
              <Skeleton h="12px" w="30px" mt={1} />
            </VStack>
          </HStack>
        ))
      ) : tokens.length === 0 ? (
        <Box p={3}>
          <Text fontSize="sm" color="text.tertiary" textAlign="center">
            No tokens found
          </Text>
        </Box>
      ) : (
        tokens.map((token, i) => (
          <HStack
            key={`${token.chainId}-${token.contractAddress}-${i}`}
            w="full"
            p={2.5}
            px={3}
            borderBottom={i < tokens.length - 1 ? "1px solid" : "none"}
            borderColor="gray.200"
            cursor={onTokenClick ? "pointer" : "default"}
            _hover={onTokenClick ? { bg: "bg.muted" } : {}}
            onClick={() => onTokenClick?.(token)}
            transition="background 0.15s"
          >
            {/* Token icon */}
            <Box position="relative">
              <Box
                bg="bg.muted"
                border="2px solid"
                borderColor="bauhaus.black"
                borderRadius="full"
                w="24px"
                h="24px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
              >
                {token.logoUrl ? (
                  <Image
                    src={token.logoUrl}
                    alt={token.symbol}
                    boxSize="20px"
                    fallback={
                      <Text fontSize="9px" fontWeight="800" color="text.secondary">
                        {token.symbol.slice(0, 3)}
                      </Text>
                    }
                  />
                ) : (
                  <Text fontSize="9px" fontWeight="800" color="text.secondary">
                    {token.symbol.slice(0, 3)}
                  </Text>
                )}
              </Box>
              {/* Chain badge */}
              {(() => {
                const config = getChainConfig(token.chainId);
                return config.icon ? (
                  <Image
                    src={config.icon}
                    alt=""
                    boxSize="12px"
                    position="absolute"
                    bottom="-2px"
                    right="-4px"
                    border="1px solid"
                    borderColor="bauhaus.black"
                    borderRadius="full"
                    bg="white"
                  />
                ) : null;
              })()}
            </Box>

            {/* Token info */}
            <VStack align="start" spacing={0} flex={1} minW={0}>
              <Text fontSize="xs" fontWeight="700" color="text.primary" noOfLines={1}>
                {token.symbol}
              </Text>
              <Text fontSize="10px" color="text.tertiary" fontWeight="500" noOfLines={1}>
                {token.balanceFormatted}
              </Text>
            </VStack>

            {/* Value */}
            <VStack align="end" spacing={0} minW="50px">
              <Text fontSize="xs" fontWeight="700" color="text.primary">
                {formatUsd(token.valueUsd)}
              </Text>
              {!hideValue && token.priceUsd > 0 && (
                <Text fontSize="10px" color="text.tertiary" fontWeight="500">
                  ${token.priceUsd < 0.01 ? "<0.01" : token.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </Text>
              )}
            </VStack>
          </HStack>
        ))
      )}
    </VStack>
  );

  if (hideCard) return tokenList;

  return (
    <Box
      bg="bauhaus.white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      position="relative"
    >
      {/* Corner decoration */}
      <Box
        position="absolute"
        top="-3px"
        right="-3px"
        w="10px"
        h="10px"
        bg="bauhaus.yellow"
        border="2px solid"
        borderColor="bauhaus.black"
      />

      {/* Header */}
      {!hideHeader && (
        <HStack p={3} borderBottom="2px solid" borderColor="bauhaus.black" justify="space-between">
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="700" color="text.secondary" textTransform="uppercase">
              Holdings
            </Text>
            {loading && <Skeleton h="14px" w="60px" />}
            {!loading && (
              <Text fontSize="sm" fontWeight="900" color="text.primary">
                {formatUsd(totalValueUsd)}
              </Text>
            )}
          </HStack>
          <HStack spacing={1}>
            <Tooltip label={hideValue ? "Show values" : "Hide values"} hasArrow>
              <IconButton
                aria-label={hideValue ? "Show values" : "Hide values"}
                icon={hideValue ? <ViewOffIcon /> : <ViewIcon />}
                size="xs"
                variant="ghost"
                color="text.secondary"
                onClick={toggleHideValue}
                _hover={{ color: "bauhaus.blue" }}
                minW="auto"
              />
            </Tooltip>
            <Tooltip label="Refresh" hasArrow>
              <IconButton
                aria-label="Refresh portfolio"
                icon={<RepeatIcon />}
                size="xs"
                variant="ghost"
                color="text.secondary"
                onClick={() => loadPortfolio(true)}
                _hover={{ color: "bauhaus.blue" }}
                minW="auto"
                isDisabled={loading}
              />
            </Tooltip>
          </HStack>
        </HStack>
      )}

      {tokenList}
    </Box>
  );
}

export default memo(TokenHoldings);
