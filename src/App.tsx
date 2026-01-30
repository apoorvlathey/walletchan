import { useState, useEffect } from "react";
import {
  useUpdateEffect,
  Flex,
  Spacer,
  Container,
  Text,
  HStack,
  Box,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Image,
  IconButton,
  Code,
  useToast,
  VStack,
  Tooltip,
  Icon,
} from "@chakra-ui/react";
import { SettingsIcon, ChevronDownIcon, CopyIcon, CheckIcon, ExternalLinkIcon } from "@chakra-ui/icons";

// Sidepanel icon
const SidePanelIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm12 2v14h5V5h-5zM4 5v14h10V5H4z"
    />
  </Icon>
);
import Settings from "@/components/Settings";
import UnlockScreen from "@/components/UnlockScreen";
import PendingTxBanner from "@/components/PendingTxBanner";
import PendingTxList from "@/components/PendingTxList";
import TransactionConfirmation from "@/components/TransactionConfirmation";
import { useNetworks } from "@/contexts/NetworksContext";
import { getChainConfig } from "@/constants/chainConfig";
import { hasEncryptedApiKey } from "@/chrome/crypto";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";

type AppView = "main" | "unlock" | "settings" | "pendingTxList" | "txConfirm";

function App() {
  const { networksInfo, reloadRequired, setReloadRequired } = useNetworks();
  const toast = useToast();

  const [view, setView] = useState<AppView>("main");
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>("");
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const [chainName, setChainName] = useState<string>();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingTxRequest[]>([]);
  const [selectedTxRequest, setSelectedTxRequest] = useState<PendingTxRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [sidePanelSupported, setSidePanelSupported] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState(false);
  const [isInSidePanel, setIsInSidePanel] = useState(false);

  const currentTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  };

  const loadPendingRequests = async () => {
    return new Promise<PendingTxRequest[]>((resolve) => {
      chrome.runtime.sendMessage({ type: "getPendingTxRequests" }, (requests) => {
        setPendingRequests(requests || []);
        resolve(requests || []);
      });
    });
  };

  const checkLockState = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "isApiKeyCached" }, (cached) => {
        resolve(cached);
      });
    });
  };

  // Check sidepanel support and mode on mount
  useEffect(() => {
    const checkSidePanelSupport = async () => {
      return new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({ type: "isSidePanelSupported" }, (response) => {
          resolve(response?.supported || false);
        });
      });
    };

    const checkSidePanelMode = async () => {
      return new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({ type: "getSidePanelMode" }, (response) => {
          resolve(response?.enabled || false);
        });
      });
    };

    const detectSidePanelContext = () => {
      // Detect if we're running in a sidepanel context by checking window dimensions
      // Sidepanel typically has more height than the popup's fixed 480-600px
      const isWideEnough = window.innerWidth >= 300;
      const isTall = window.innerHeight > 620;
      return isWideEnough && isTall;
    };

    const initSidePanel = async () => {
      const supported = await checkSidePanelSupport();
      setSidePanelSupported(supported);

      if (supported) {
        const mode = await checkSidePanelMode();
        setSidePanelMode(mode);
      }

      // Detect if currently in sidepanel
      const inSidePanel = detectSidePanelContext();
      setIsInSidePanel(inSidePanel);

      // Add/remove body class for CSS
      if (inSidePanel) {
        document.body.classList.add("sidepanel-mode");
      } else {
        document.body.classList.remove("sidepanel-mode");
      }
    };

    initSidePanel();

    // Listen for window resize to update sidepanel detection
    const handleResize = () => {
      const inSidePanel = window.innerHeight > 620;
      setIsInSidePanel(inSidePanel);
      if (inSidePanel) {
        document.body.classList.add("sidepanel-mode");
      } else {
        document.body.classList.remove("sidepanel-mode");
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidePanelMode = async () => {
    const newMode = !sidePanelMode;

    // Update the mode setting
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "setSidePanelMode", enabled: newMode }, () => {
        resolve();
      });
    });
    setSidePanelMode(newMode);

    if (!newMode && isInSidePanel) {
      // Switching from sidepanel to popup mode while in sidepanel
      // Open popup window, then close sidepanel
      chrome.runtime.sendMessage({ type: "openPopupWindow" }, () => {
        window.close();
      });
    } else if (newMode && !isInSidePanel) {
      // Switching from popup to sidepanel mode while in popup
      // Chrome doesn't allow programmatic sidepanel open, show toast
      toast({
        title: "Sidepanel mode enabled",
        description: "Close popup and click the extension icon to open in sidepanel",
        status: "info",
        duration: null,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    const init = async () => {
      // Check if API key is configured
      const apiKeyConfigured = await hasEncryptedApiKey();
      setHasApiKey(apiKeyConfigured);

      if (!apiKeyConfigured) {
        // No API key - show settings to configure
        setView("settings");
        setIsLoading(false);
        return;
      }

      // Check lock state
      const isUnlocked = await checkLockState();

      // Load pending requests
      const requests = await loadPendingRequests();

      // Load stored data
      const {
        displayAddress: storedDisplayAddress,
        address: storedAddress,
        chainName: storedChainName,
      } = (await chrome.storage.sync.get([
        "displayAddress",
        "address",
        "chainName",
      ])) as {
        displayAddress: string | undefined;
        address: string | undefined;
        chainName: string | undefined;
      };

      if (storedDisplayAddress) {
        setDisplayAddress(storedDisplayAddress);
      }

      if (storedAddress) {
        setAddress(storedAddress);
      }

      if (storedChainName) {
        setChainName(storedChainName);
      }

      // Check if injected in current tab and get latest state
      const tab = await currentTab();
      chrome.tabs.sendMessage(
        tab.id!,
        { type: "getInfo" },
        (store: { address: string; displayAddress: string; chainName: string }) => {
          if (store?.chainName && store.chainName.length > 0) {
            if (store.address) setAddress(store.address);
            if (store.displayAddress) setDisplayAddress(store.displayAddress);
            if (store.chainName) setChainName(store.chainName);
          }
        }
      );

      // Determine initial view
      if (!isUnlocked) {
        setView("unlock");
      } else if (requests.length > 0) {
        // Auto-open newest (last) pending request
        setSelectedTxRequest(requests[requests.length - 1]);
        setView("txConfirm");
      } else {
        setView("main");
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Listen for new pending tx requests (when sidepanel/popup is already open)
  // Also respond to ping messages so background knows a view is open
  useEffect(() => {
    const handleMessage = (
      message: { type: string; txRequest?: PendingTxRequest },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === "ping") {
        // Respond to ping so background knows we're open
        sendResponse("pong");
        return true;
      }
      if (message.type === "newPendingTxRequest" && message.txRequest) {
        // Update pending requests list
        setPendingRequests((prev) => [...prev, message.txRequest!]);
        // Show the new tx request
        setSelectedTxRequest(message.txRequest);
        setView("txConfirm");
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useUpdateEffect(() => {
    const updateChainId = async () => {
      if (networksInfo && chainName) {
        const tab = await currentTab();
        const chainId = networksInfo[chainName].chainId;

        chrome.tabs.sendMessage(tab.id!, {
          type: "setChainId",
          msg: { chainName, chainId, rpcUrl: networksInfo[chainName].rpcUrl },
        });

        await chrome.storage.sync.set({ chainName });
      }
    };

    updateChainId();
  }, [chainName, networksInfo]);

  useUpdateEffect(() => {
    if (reloadRequired && networksInfo) {
      setChainName(Object.keys(networksInfo)[0]);
    }
  }, [reloadRequired, networksInfo]);

  const handleUnlock = async () => {
    // Refresh pending requests after unlock
    const requests = await loadPendingRequests();

    if (requests.length > 0) {
      // Show newest (last) pending request
      setSelectedTxRequest(requests[requests.length - 1]);
      setView("txConfirm");
    } else {
      setView("main");
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address copied!",
        status: "success",
        duration: 1500,
        isClosable: true,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleTxConfirmed = async () => {
    const currentTxId = selectedTxRequest?.id;
    const requests = await loadPendingRequests();

    // Check if more pending requests (use fresh data from loadPendingRequests)
    const remaining = requests.filter((r) => r.id !== currentTxId);
    if (remaining.length > 0) {
      setSelectedTxRequest(remaining[0]);
    } else {
      setSelectedTxRequest(null);
      setView("main");
    }
  };

  const handleTxRejected = async () => {
    const currentTxId = selectedTxRequest?.id;
    const requests = await loadPendingRequests();

    // Check if more pending requests (use fresh data from loadPendingRequests)
    const remaining = requests.filter((r) => r.id !== currentTxId);
    if (remaining.length > 0) {
      setSelectedTxRequest(remaining[0]);
    } else {
      // Close popup when no more pending requests
      window.close();
    }
  };

  const handleRejectAll = async () => {
    // Reject all pending transactions
    for (const request of pendingRequests) {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: "rejectTransaction", txId: request.id },
          () => resolve()
        );
      });
    }
    // Close popup after rejecting all
    window.close();
  };

  const truncateAddress = (addr: string): string => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <Box
        minH="300px"
        bg="bg.base"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="text.secondary">Loading...</Text>
      </Box>
    );
  }

  // Unlock screen
  if (view === "unlock") {
    return <UnlockScreen onUnlock={handleUnlock} />;
  }

  // Settings view
  if (view === "settings") {
    return (
      <Box bg="bg.base" minH="300px">
        <Container pt={4} pb={4}>
          <Settings
            close={() => {
              // After settings, check if now have API key
              hasEncryptedApiKey().then((has) => {
                setHasApiKey(has);
                if (has) {
                  checkLockState().then((unlocked) => {
                    if (unlocked) {
                      setView("main");
                    } else {
                      setView("unlock");
                    }
                  });
                }
              });
            }}
            showBackButton={hasApiKey}
          />
        </Container>
      </Box>
    );
  }

  // Pending tx list view
  if (view === "pendingTxList") {
    return (
      <PendingTxList
        requests={pendingRequests}
        onBack={() => setView("main")}
        onSelectTx={(tx) => {
          setSelectedTxRequest(tx);
          setView("txConfirm");
        }}
        onRejectAll={handleRejectAll}
      />
    );
  }

  // Transaction confirmation view
  if (view === "txConfirm" && selectedTxRequest) {
    const currentIndex = pendingRequests.findIndex(
      (r) => r.id === selectedTxRequest.id
    );
    return (
      <TransactionConfirmation
        key={selectedTxRequest.id}
        txRequest={selectedTxRequest}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        totalCount={pendingRequests.length}
        onBack={() => {
          if (pendingRequests.length > 1) {
            setView("pendingTxList");
          } else {
            setView("main");
          }
        }}
        onConfirmed={handleTxConfirmed}
        onRejected={handleTxRejected}
        onRejectAll={handleRejectAll}
        onNavigate={(direction) => {
          const currentIdx = pendingRequests.findIndex(
            (r) => r.id === selectedTxRequest.id
          );
          if (direction === "prev" && currentIdx > 0) {
            setSelectedTxRequest(pendingRequests[currentIdx - 1]);
          } else if (direction === "next" && currentIdx < pendingRequests.length - 1) {
            setSelectedTxRequest(pendingRequests[currentIdx + 1]);
          }
        }}
      />
    );
  }

  // Main view
  return (
    <Box bg="bg.base" minH="300px">
      {/* Header */}
      <Flex
        py={3}
        px={4}
        bg="bg.subtle"
        borderBottom="1px"
        borderBottomColor="border.default"
        alignItems="center"
      >
        <HStack spacing={2}>
          <Image src="impersonatorLogo.png" w="1.8rem" />
          <Text fontWeight="600" color="text.primary">
            BankrWallet
          </Text>
        </HStack>
        <Spacer />
        <HStack spacing={1}>
          {sidePanelSupported && (
            <Tooltip
              label={sidePanelMode ? "Switch to popup mode" : "Switch to sidepanel mode"}
              placement="bottom"
            >
              <IconButton
                aria-label={sidePanelMode ? "Switch to popup mode" : "Switch to sidepanel mode"}
                icon={<SidePanelIcon />}
                variant="ghost"
                size="sm"
                onClick={toggleSidePanelMode}
              />
            </Tooltip>
          )}
          <IconButton
            aria-label="Settings"
            icon={<SettingsIcon />}
            variant="ghost"
            size="sm"
            onClick={() => setView("settings")}
          />
        </HStack>
      </Flex>

      <Container pt={4} pb={4}>
        <VStack spacing={4} align="stretch">
          {/* Pending Requests Banner */}
          <PendingTxBanner
            count={pendingRequests.length}
            onClick={() => {
              if (pendingRequests.length === 1) {
                setSelectedTxRequest(pendingRequests[0]);
                setView("txConfirm");
              } else {
                setView("pendingTxList");
              }
            }}
          />

          {/* Address Display */}
          <Box
            bg="bg.subtle"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="border.default"
            px={4}
            py={3}
          >
            {address ? (
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Code
                    fontSize="md"
                    fontFamily="mono"
                    bg="transparent"
                    color="text.primary"
                    fontWeight="500"
                  >
                    {truncateAddress(address)}
                  </Code>
                  <IconButton
                    aria-label="Copy address"
                    icon={copied ? <CheckIcon /> : <CopyIcon />}
                    size="xs"
                    variant="ghost"
                    color={copied ? "success.solid" : "text.secondary"}
                    onClick={handleCopyAddress}
                    _hover={{ color: "text.primary", bg: "bg.emphasis" }}
                  />
                </HStack>
                {chainName && networksInfo && (
                  <IconButton
                    aria-label="View on explorer"
                    icon={<ExternalLinkIcon />}
                    size="xs"
                    variant="ghost"
                    color="text.secondary"
                    onClick={() => {
                      const config = getChainConfig(networksInfo[chainName].chainId);
                      if (config.explorer) {
                        chrome.tabs.create({
                          url: `${config.explorer}/address/${address}`,
                        });
                      }
                    }}
                    _hover={{ color: "text.primary", bg: "bg.emphasis" }}
                  />
                )}
              </HStack>
            ) : (
              <Text color="text.tertiary" fontSize="sm" textAlign="center">
                No address configured
              </Text>
            )}
          </Box>

          {/* Chain Selector */}
          <Menu matchWidth>
            <MenuButton
              as={Button}
              w="full"
              variant="ghost"
              rounded="lg"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.default"
              _hover={{ borderColor: "border.strong" }}
              _active={{ bg: "bg.emphasis" }}
              rightIcon={<ChevronDownIcon />}
              textAlign="left"
              fontWeight="normal"
              h="auto"
              py={3}
            >
              {chainName && networksInfo ? (
                <HStack spacing={2}>
                  {getChainConfig(networksInfo[chainName].chainId).icon && (
                    <Image
                      src={getChainConfig(networksInfo[chainName].chainId).icon}
                      alt={chainName}
                      boxSize="20px"
                    />
                  )}
                  <Text color="text.primary">{chainName}</Text>
                </HStack>
              ) : (
                <Text color="text.tertiary">Select Network</Text>
              )}
            </MenuButton>
            <MenuList bg="bg.subtle" borderColor="border.default" py={1}>
              {networksInfo &&
                Object.keys(networksInfo).map((_chainName, i) => {
                  const config = getChainConfig(networksInfo[_chainName].chainId);
                  return (
                    <MenuItem
                      key={i}
                      bg="bg.subtle"
                      _hover={{ bg: "bg.emphasis" }}
                      onClick={() => {
                        if (!chainName) {
                          setReloadRequired(true);
                        }
                        setChainName(_chainName);
                      }}
                    >
                      <HStack spacing={2}>
                        {config.icon && (
                          <Image
                            src={config.icon}
                            alt={_chainName}
                            boxSize="20px"
                          />
                        )}
                        <Text color="text.primary">{_chainName}</Text>
                      </HStack>
                    </MenuItem>
                  );
                })}
            </MenuList>
          </Menu>

          {/* Reload Required Alert */}
          {reloadRequired && (
            <Alert
              status="warning"
              rounded="lg"
              bg="warning.bg"
              borderWidth="1px"
              borderColor="warning.border"
            >
              <AlertIcon color="warning.solid" />
              <Box flex={1}>
                <AlertTitle fontSize="sm" color="text.primary">
                  Reload page required
                </AlertTitle>
                <AlertDescription fontSize="xs" color="text.secondary">
                  To apply changes on the current site
                </AlertDescription>
              </Box>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  const tab = await currentTab();
                  const url = tab.url!;
                  chrome.tabs.create({ url });
                  chrome.tabs.remove(tab.id!);
                  setReloadRequired(false);
                }}
              >
                Reload
              </Button>
            </Alert>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

export default App;
