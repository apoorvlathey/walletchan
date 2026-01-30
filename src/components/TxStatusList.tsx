import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
  Image,
  IconButton,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  WarningIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@chakra-ui/icons";
import { CompletedTransaction } from "@/chrome/txHistoryStorage";
import { getChainConfig } from "@/constants/chainConfig";

interface TxStatusListProps {
  maxItems?: number;
}

function TxStatusList({ maxItems = 5 }: TxStatusListProps) {
  const [history, setHistory] = useState<CompletedTransaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load and listen for updates
  useEffect(() => {
    // Initial load
    chrome.runtime.sendMessage({ type: "getTxHistory" }, (result) => {
      setHistory(result || []);
    });

    // Listen for updates
    const handleMessage = (message: { type: string }) => {
      if (message.type === "txHistoryUpdated") {
        chrome.runtime.sendMessage({ type: "getTxHistory" }, (result) => {
          setHistory(result || []);
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const displayItems = isExpanded ? history : history.slice(0, maxItems);
  const hasMore = history.length > maxItems;

  return (
    <Box pt={4}>
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" fontWeight="600" color="text.primary">
          Recent Transactions
        </Text>
        {hasMore && (
          <IconButton
            aria-label={isExpanded ? "Show less" : "Show more"}
            icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            size="xs"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          />
        )}
      </HStack>

      {history.length === 0 ? (
        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="lg"
          p={4}
          textAlign="center"
        >
          <Text fontSize="sm" color="text.tertiary">
            No recent transactions
          </Text>
        </Box>
      ) : (
        <VStack spacing={2} align="stretch">
          {displayItems.map((tx) => (
            <TxStatusItem key={tx.id} tx={tx} />
          ))}
        </VStack>
      )}
    </Box>
  );
}

function TxStatusItem({ tx }: { tx: CompletedTransaction }) {
  const config = getChainConfig(tx.chainId);

  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStatusBadge = () => {
    switch (tx.status) {
      case "processing":
        return (
          <Badge
            bg="info.bg"
            color="info.solid"
            borderWidth="1px"
            borderColor="info.border"
            borderRadius="full"
            px={2}
            py={0.5}
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={1}
          >
            <Spinner size="xs" />
            Processing
          </Badge>
        );
      case "success":
        return (
          <Badge
            bg="success.bg"
            color="success.solid"
            borderWidth="1px"
            borderColor="success.border"
            borderRadius="full"
            px={2}
            py={0.5}
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={1}
          >
            <CheckCircleIcon boxSize={3} />
            Confirmed
          </Badge>
        );
      case "failed":
        return (
          <Badge
            bg="error.bg"
            color="error.solid"
            borderWidth="1px"
            borderColor="error.border"
            borderRadius="full"
            px={2}
            py={0.5}
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={1}
          >
            <WarningIcon boxSize={3} />
            Failed
          </Badge>
        );
    }
  };

  const handleViewTx = () => {
    if (tx.status === "success" && tx.txHash && config.explorer) {
      // Extract hash if txHash contains full URL or just hash
      const hash = tx.txHash.match(/0x[a-fA-F0-9]{64}/)?.[0];
      if (hash) {
        chrome.tabs.create({ url: `${config.explorer}/tx/${hash}` });
      }
    }
  };

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      p={3}
      _hover={{
        bg: "bg.emphasis",
        borderColor: "border.strong",
      }}
      transition="all 0.2s"
    >
      <HStack justify="space-between">
        <HStack spacing={3} flex={1}>
          <Box
            bg="white"
            p="2px"
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Image
              src={
                tx.favicon ||
                `https://www.google.com/s2/favicons?domain=${new URL(tx.origin).hostname}&sz=32`
              }
              alt="favicon"
              boxSize="20px"
              borderRadius="sm"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://www.google.com/s2/favicons?domain=${new URL(tx.origin).hostname}&sz=32`;
              }}
            />
          </Box>
          <Box flex={1}>
            <HStack justify="space-between">
              <Text
                fontSize="sm"
                fontWeight="500"
                color="text.primary"
                noOfLines={1}
              >
                {new URL(tx.origin).hostname}
              </Text>
              <Text fontSize="xs" color="text.tertiary">
                {formatTimeAgo(tx.createdAt)}
              </Text>
            </HStack>
            <HStack spacing={2} mt={1}>
              <Badge
                fontSize="xs"
                bg={config.bg}
                color={config.text}
                borderWidth="1px"
                borderColor={config.border}
                borderRadius="full"
                px={2}
                py={0.5}
                display="flex"
                alignItems="center"
                gap={1}
              >
                {config.icon && (
                  <Image src={config.icon} alt={tx.chainName} boxSize="10px" />
                )}
                {tx.chainName}
              </Badge>
              {getStatusBadge()}
            </HStack>
          </Box>
        </HStack>

        {tx.status === "success" && tx.txHash && config.explorer && (
          <IconButton
            aria-label="View on explorer"
            icon={<ExternalLinkIcon />}
            size="sm"
            variant="ghost"
            color="text.secondary"
            onClick={handleViewTx}
            _hover={{ color: "text.primary", bg: "bg.emphasis" }}
          />
        )}
      </HStack>

      {/* Show error message for failed transactions */}
      {tx.status === "failed" && tx.error && (
        <Box
          mt={2}
          p={2}
          bg="error.bg"
          borderRadius="md"
          borderWidth="1px"
          borderColor="error.border"
        >
          <Text fontSize="xs" color="text.secondary" noOfLines={2}>
            {tx.error}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default TxStatusList;
