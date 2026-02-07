import { useState, useCallback, lazy, Suspense } from "react";
import {
  Box,
  HStack,
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  IconButton,
  Tooltip,
  Skeleton,
} from "@chakra-ui/react";
import { RepeatIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import TxStatusList from "@/components/TxStatusList";
import type { PortfolioToken } from "@/chrome/portfolioApi";

const TokenHoldings = lazy(() => import("@/components/TokenHoldings"));

interface HoldingsState {
  totalValueUsd: number;
  loading: boolean;
  hideValue: boolean;
  toggleHideValue: () => void;
  refresh: () => void;
}

interface PortfolioTabsProps {
  address: string;
  onTokenClick?: (token: PortfolioToken) => void;
}

export default function PortfolioTabs({ address, onTokenClick }: PortfolioTabsProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [holdingsState, setHoldingsState] = useState<HoldingsState | null>(null);

  const handleStateChange = useCallback((state: HoldingsState) => {
    setHoldingsState(state);
  }, []);

  const formatUsd = (value: number): string => {
    if (holdingsState?.hideValue) return "****";
    if (value === 0) return "$0.00";
    if (value < 0.01) return "<$0.01";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
        zIndex={1}
      />

      <Tabs index={tabIndex} onChange={setTabIndex} variant="unstyled">
        {/* Tab bar */}
        <HStack
          borderBottom="2px solid"
          borderColor="bauhaus.black"
          spacing={0}
          justify="space-between"
        >
          <TabList flex={1}>
            <Tab
              px={3}
              py={2.5}
              fontSize="sm"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="wide"
              borderRadius={0}
              color={tabIndex === 0 ? "bauhaus.white" : "text.secondary"}
              bg={tabIndex === 0 ? "bauhaus.black" : "transparent"}
              _hover={tabIndex === 0 ? {} : { bg: "bg.muted" }}
              _selected={{
                color: "bauhaus.white",
                bg: "bauhaus.black",
              }}
            >
              <HStack spacing={1.5}>
                <Text>Holdings</Text>
                {tabIndex === 0 && holdingsState && (
                  <>
                    {holdingsState.loading ? (
                      <Skeleton h="12px" w="50px" />
                    ) : (
                      <Text fontSize="xs" fontWeight="900" color="bauhaus.yellow">
                        {formatUsd(holdingsState.totalValueUsd)}
                      </Text>
                    )}
                  </>
                )}
              </HStack>
            </Tab>
            <Tab
              px={3}
              py={2.5}
              fontSize="sm"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="wide"
              borderRadius={0}
              color={tabIndex === 1 ? "bauhaus.white" : "text.secondary"}
              bg={tabIndex === 1 ? "bauhaus.black" : "transparent"}
              _hover={tabIndex === 1 ? {} : { bg: "bg.muted" }}
              _selected={{
                color: "bauhaus.white",
                bg: "bauhaus.black",
              }}
            >
              Activity
            </Tab>
          </TabList>

          {/* Action buttons - only visible on Holdings tab */}
          {tabIndex === 0 && holdingsState && (
            <HStack spacing={1} pr={2}>
              <Tooltip label={holdingsState.hideValue ? "Show values" : "Hide values"} hasArrow>
                <IconButton
                  aria-label={holdingsState.hideValue ? "Show values" : "Hide values"}
                  icon={holdingsState.hideValue ? <ViewOffIcon /> : <ViewIcon />}
                  size="xs"
                  variant="ghost"
                  color="text.secondary"
                  onClick={holdingsState.toggleHideValue}
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
                  onClick={holdingsState.refresh}
                  _hover={{ color: "bauhaus.blue" }}
                  minW="auto"
                  isDisabled={holdingsState.loading}
                />
              </Tooltip>
            </HStack>
          )}
        </HStack>

        <TabPanels>
          <TabPanel p={0}>
            <Suspense fallback={<Skeleton h="100px" />}>
              <TokenHoldings
                address={address}
                onTokenClick={onTokenClick}
                hideHeader
                hideCard
                onStateChange={handleStateChange}
              />
            </Suspense>
          </TabPanel>
          <TabPanel p={0}>
            <Box
              maxH="300px"
              overflowY="auto"
              p={2}
              css={{
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
                "&::-webkit-scrollbar-thumb": { background: "#121212" },
              }}
            >
              <TxStatusList maxItems={10} address={address} hideHeader hideCard />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
