import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
  Image,
  IconButton,
  Button,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  WarningIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
} from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { CompletedTransaction } from "@/chrome/txHistoryStorage";
import { getChainConfig } from "@/constants/chainConfig";
import TxDetailModal from "@/components/TxDetailModal";

interface TxStatusListProps {
  maxItems?: number;
  address?: string; // Filter transactions by this address
  hideHeader?: boolean;
  hideCard?: boolean;
}

function TxStatusList({
  maxItems = 5,
  address,
  hideHeader,
  hideCard,
}: TxStatusListProps) {
  const [allHistory, setAllHistory] = useState<CompletedTransaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTx, setSelectedTx] = useState<CompletedTransaction | null>(
    null,
  );

  // Load and listen for updates
  useEffect(() => {
    // Initial load
    chrome.runtime.sendMessage({ type: "getTxHistory" }, (result) => {
      setAllHistory(result || []);
    });

    // Listen for updates
    const handleMessage = (message: { type: string }) => {
      if (message.type === "txHistoryUpdated") {
        chrome.runtime.sendMessage({ type: "getTxHistory" }, (result) => {
          setAllHistory(result || []);
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Filter history by address (case-insensitive comparison)
  const history = address
    ? allHistory.filter(
        (tx) => tx.tx.from.toLowerCase() === address.toLowerCase(),
      )
    : allHistory;

  const displayItems = isExpanded ? history : history.slice(0, maxItems);
  const hasMore = history.length > maxItems;

  const txContent =
    history.length === 0 ? (
      <Box p={4} textAlign="center">
        <Text fontSize="sm" color="text.tertiary" fontWeight="500">
          No recent transactions
        </Text>
      </Box>
    ) : (
      <VStack spacing={hideCard ? 3 : 3} align="stretch" p={hideCard ? 0 : 0}>
        {displayItems.map((tx) => (
          <TxStatusItem key={tx.id} tx={tx} onClick={() => setSelectedTx(tx)} />
        ))}
      </VStack>
    );

  const modal = selectedTx && (
    <TxDetailModal
      isOpen={!!selectedTx}
      onClose={() => setSelectedTx(null)}
      tx={selectedTx}
    />
  );

  if (hideCard) {
    return (
      <Box>
        {!hideHeader && (
          <HStack justify="space-between" mb={3}>
            <Text
              fontSize="sm"
              fontWeight="900"
              color="text.primary"
              textTransform="uppercase"
              letterSpacing="wider"
            >
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
        )}
        {txContent}
        {modal}
      </Box>
    );
  }

  return (
    <Box pt={4}>
      {!hideHeader ? (
        <HStack justify="space-between" mb={3}>
          <Text
            fontSize="sm"
            fontWeight="900"
            color="text.primary"
            textTransform="uppercase"
            letterSpacing="wider"
          >
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
      ) : null}

      {history.length === 0 ? (
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={4}
          textAlign="center"
        >
          <Text fontSize="sm" color="text.tertiary" fontWeight="500">
            No recent transactions
          </Text>
        </Box>
      ) : (
        <VStack spacing={3} align="stretch">
          {displayItems.map((tx) => (
            <TxStatusItem
              key={tx.id}
              tx={tx}
              onClick={() => setSelectedTx(tx)}
            />
          ))}
        </VStack>
      )}
      {modal}
    </Box>
  );
}

function getOriginHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function TxStatusItem({
  tx,
  onClick,
}: {
  tx: CompletedTransaction;
  onClick: () => void;
}) {
  const config = getChainConfig(tx.chainId);
  const toast = useBauhausToast();
  const [cancelling, setCancelling] = useState(false);
  const originHostname = getOriginHostname(tx.origin);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const result = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          chrome.runtime.sendMessage(
            { type: "cancelProcessingTx", txId: tx.id },
            resolve,
          );
        },
      );
      if (result.success) {
        toast({
          title: "Transaction cancelled",
          status: "info",
          duration: 2000,
        });
      } else {
        toast({
          title: result.error || "Cancel failed",
          status: "error",
          duration: 2000,
        });
      }
    } catch {
      toast({ title: "Cancel failed", status: "error", duration: 2000 });
    } finally {
      setCancelling(false);
    }
  };

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
            bg="bauhaus.blue"
            color="white"
            border="2px solid"
            borderColor="bauhaus.black"
            px={2}
            py={0.5}
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={1}
          >
            <Spinner size="xs" color="white" />
            Processing
          </Badge>
        );
      case "success":
        return (
          <Badge
            bg="bauhaus.yellow"
            color="bauhaus.black"
            border="2px solid"
            borderColor="bauhaus.black"
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
            bg="bauhaus.red"
            color="white"
            border="2px solid"
            borderColor="bauhaus.black"
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
      bg="bauhaus.white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      p={3}
      cursor="pointer"
      onClick={onClick}
      _hover={{
        transform: "translateY(-1px)",
        boxShadow: "5px 5px 0px 0px #121212",
      }}
      transition="all 0.2s ease-out"
      position="relative"
    >
      {/* Corner decoration based on status */}
      <Box
        position="absolute"
        top="-3px"
        right="-3px"
        w="8px"
        h="8px"
        bg={
          tx.status === "success"
            ? "bauhaus.yellow"
            : tx.status === "failed"
              ? "bauhaus.red"
              : "bauhaus.blue"
        }
        border="2px solid"
        borderColor="bauhaus.black"
        borderRadius={tx.status === "success" ? "full" : "0"}
      />

      <HStack justify="space-between">
        <HStack spacing={3} flex={1}>
          <Box
            bg={tx.origin === "WalletChan" ? "transparent" : "bauhaus.white"}
            border="2px solid"
            borderColor={
              tx.origin === "WalletChan" ? "transparent" : "bauhaus.black"
            }
            p={tx.origin === "WalletChan" ? 0 : 1}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Image
              src={
                // keeping BankrWallet for backwards compatibility so the activity isn't messed up
                tx.origin === "WalletChan" || tx.origin === "BankrWallet"
                  ? "/walletchan-icon.png"
                  : tx.favicon ||
                    (originHostname
                      ? `https://www.google.com/s2/favicons?domain=${originHostname}&sz=32`
                      : undefined)
              }
              alt="favicon"
              boxSize={tx.origin === "WalletChan" ? "24px" : "18px"}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (originHostname) {
                  target.src = `https://www.google.com/s2/favicons?domain=${originHostname}&sz=32`;
                }
              }}
            />
          </Box>
          <Box flex={1}>
            <HStack justify="space-between">
              <HStack spacing={1.5} flex={1} minW={0}>
                <Text
                  fontSize="sm"
                  fontWeight="700"
                  color="text.primary"
                  noOfLines={1}
                >
                  {originHostname || tx.origin}
                </Text>
                {tx.functionName && (
                  <Badge
                    fontSize="2xs"
                    bg="bg.muted"
                    color="text.secondary"
                    border="2px solid"
                    borderColor="gray.300"
                    fontFamily="mono"
                    textTransform="none"
                    px={1.5}
                    py={0}
                    flexShrink={0}
                  >
                    {tx.functionName}
                  </Badge>
                )}
              </HStack>
              <Text
                fontSize="xs"
                color="text.tertiary"
                fontWeight="500"
                flexShrink={0}
              >
                {formatTimeAgo(tx.createdAt)}
              </Text>
            </HStack>
            <HStack spacing={2} mt={1}>
              <Badge
                fontSize="xs"
                bg={config.bg}
                color={config.text}
                border="2px solid"
                borderColor="bauhaus.black"
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
            onClick={(e) => {
              e.stopPropagation();
              handleViewTx();
            }}
            _hover={{ color: "bauhaus.blue", bg: "bg.muted" }}
          />
        )}
      </HStack>

      {/* Cancel button temporarily disabled
      {tx.status === "processing" && tx.accountType !== "bankr" && (
        <HStack justify="flex-end" mt={1}>
          <Button
            size="xs"
            color="bauhaus.red"
            variant="ghost"
            fontWeight="700"
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            isLoading={cancelling}
            loadingText=""
            leftIcon={<CloseIcon boxSize="8px" />}
            _hover={{ bg: "bauhaus.red", color: "white" }}
          >
            Cancel
          </Button>
        </HStack>
      )}
      */}

      {/* Show error message for failed transactions */}
      {tx.status === "failed" && tx.error && (
        <Box
          mt={2}
          p={2}
          bg="bauhaus.red"
          border="2px solid"
          borderColor="bauhaus.black"
        >
          <Text fontSize="xs" color="white" noOfLines={2} fontWeight="500">
            {tx.error}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default memo(TxStatusList);
