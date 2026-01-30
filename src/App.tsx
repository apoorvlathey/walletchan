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
  Image,
  IconButton,
  Code,
  VStack,
  Tooltip,
  Icon,
  Link,
} from "@chakra-ui/react";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { SettingsIcon, ChevronDownIcon, CopyIcon, CheckIcon, ExternalLinkIcon, LockIcon, WarningIcon, InfoIcon } from "@chakra-ui/icons";

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
import TxStatusList from "@/components/TxStatusList";
import { useNetworks } from "@/contexts/NetworksContext";
import { getChainConfig } from "@/constants/chainConfig";
import { hasEncryptedApiKey } from "@/chrome/crypto";
import { PendingTxRequest } from "@/chrome/pendingTxStorage";
import { PendingSignatureRequest } from "@/chrome/pendingSignatureStorage";
import SignatureRequestConfirmation from "@/components/SignatureRequestConfirmation";

type AppView = "main" | "unlock" | "settings" | "pendingTxList" | "txConfirm" | "signatureConfirm" | "waitingForOnboarding";

function App() {
  const { networksInfo, reloadRequired, setReloadRequired } = useNetworks();
  const toast = useBauhausToast();

  const [view, setView] = useState<AppView>("main");
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>("");
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const [chainName, setChainName] = useState<string>();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingTxRequest[]>([]);
  const [selectedTxRequest, setSelectedTxRequest] = useState<PendingTxRequest | null>(null);
  const [pendingSignatureRequests, setPendingSignatureRequests] = useState<PendingSignatureRequest[]>([]);
  const [selectedSignatureRequest, setSelectedSignatureRequest] = useState<PendingSignatureRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [sidePanelSupported, setSidePanelSupported] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState(false);
  const [isInSidePanel, setIsInSidePanel] = useState(false);
  const [failedTxError, setFailedTxError] = useState<{ error: string; origin: string } | null>(null);
  const [onboardingTabId, setOnboardingTabId] = useState<number | null>(null);

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

  const loadPendingSignatureRequests = async () => {
    return new Promise<PendingSignatureRequest[]>((resolve) => {
      chrome.runtime.sendMessage({ type: "getPendingSignatureRequests" }, (requests) => {
        setPendingSignatureRequests(requests || []);
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
      // Sidepanel typically has more height than the popup's fixed 680px
      const isWideEnough = window.innerWidth >= 300;
      const isTall = window.innerHeight > 700;
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
      const inSidePanel = window.innerHeight > 700;
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

  // Check URL params for error display (from notification click)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showErrorId = urlParams.get("showError");

    if (showErrorId) {
      // Fetch the failed tx result from background
      chrome.runtime.sendMessage(
        { type: "getFailedTxResult", notificationId: showErrorId },
        (result: { error: string; origin: string } | null) => {
          if (result) {
            setFailedTxError({ error: result.error, origin: result.origin });
          }
          // Clear the URL param
          window.history.replaceState({}, "", window.location.pathname);
        }
      );
    }
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
        // No API key - open onboarding in a new tab
        const onboardingUrl = chrome.runtime.getURL("onboarding.html");

        // Check if onboarding tab already exists
        const existingTabs = await chrome.tabs.query({ url: onboardingUrl });
        if (existingTabs.length > 0 && existingTabs[0].id) {
          // Focus existing onboarding tab
          await chrome.tabs.update(existingTabs[0].id, { active: true });
          await chrome.windows.update(existingTabs[0].windowId!, { focused: true });
          setOnboardingTabId(existingTabs[0].id);
        } else {
          // Create new onboarding tab
          const tab = await chrome.tabs.create({ url: onboardingUrl });
          if (tab.id) {
            setOnboardingTabId(tab.id);
          }
        }

        setView("waitingForOnboarding");
        setIsLoading(false);
        return;
      }

      // API key is configured - close any open onboarding tabs
      // Use pattern matching to ensure we find the tab regardless of URL variations
      const onboardingUrlPattern = chrome.runtime.getURL("onboarding.html") + "*";
      const onboardingTabs = await chrome.tabs.query({ url: onboardingUrlPattern });
      for (const tab of onboardingTabs) {
        if (tab.id) {
          chrome.tabs.remove(tab.id).catch(() => {
            // Ignore errors if tab is already closed
          });
        }
      }

      // Check lock state
      const isUnlocked = await checkLockState();

      // Load pending requests
      const requests = await loadPendingRequests();
      const sigRequests = await loadPendingSignatureRequests();

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

      // Set chain name, defaulting to Base for new installations
      setChainName(storedChainName || "Base");

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
        // Auto-open newest (last) pending transaction request
        setSelectedTxRequest(requests[requests.length - 1]);
        setView("txConfirm");
      } else if (sigRequests.length > 0) {
        // Auto-open newest (last) pending signature request
        setSelectedSignatureRequest(sigRequests[sigRequests.length - 1]);
        setView("signatureConfirm");
      } else {
        setView("main");
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Listen for new pending tx/signature requests (when sidepanel/popup is already open)
  // Also respond to ping messages so background knows a view is open
  // Also listen for onboarding completion
  useEffect(() => {
    const handleMessage = async (
      message: { type: string; txRequest?: PendingTxRequest; sigRequest?: PendingSignatureRequest },
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
        // Check if wallet is locked before showing the request
        const isUnlocked = await checkLockState();
        if (isUnlocked) {
          // Show the new tx request
          setSelectedTxRequest(message.txRequest);
          setView("txConfirm");
        } else {
          // Wallet is locked - show unlock screen (requests will be shown after unlock)
          setView("unlock");
        }
      }
      if (message.type === "newPendingSignatureRequest" && message.sigRequest) {
        // Update pending signature requests list
        setPendingSignatureRequests((prev) => [...prev, message.sigRequest!]);
        // Check if wallet is locked before showing the request
        const isUnlocked = await checkLockState();
        if (isUnlocked) {
          // Show the new signature request
          setSelectedSignatureRequest(message.sigRequest);
          setView("signatureConfirm");
        } else {
          // Wallet is locked - show unlock screen (requests will be shown after unlock)
          setView("unlock");
        }
      }
      if (message.type === "onboardingComplete") {
        // Onboarding finished - reload to show unlock screen
        window.location.reload();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Listen for storage changes (e.g., when dapp switches chain)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "sync" && changes.chainName) {
        const newChainName = changes.chainName.newValue;
        if (newChainName && newChainName !== chainName) {
          setChainName(newChainName);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [chainName]);

  // Listen for tab activation changes to update chain for current tab
  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      // Query the newly active tab for its chain info
      chrome.tabs.sendMessage(
        activeInfo.tabId,
        { type: "getInfo" },
        (store: { address: string; displayAddress: string; chainName: string }) => {
          // Ignore errors (tab might not have content script injected)
          if (chrome.runtime.lastError) {
            return;
          }
          if (store?.chainName && store.chainName.length > 0) {
            setChainName(store.chainName);
          }
        }
      );
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    return () => chrome.tabs.onActivated.removeListener(handleTabActivated);
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
    const sigRequests = await loadPendingSignatureRequests();

    if (requests.length > 0) {
      // Show newest (last) pending transaction request
      setSelectedTxRequest(requests[requests.length - 1]);
      setView("txConfirm");
    } else if (sigRequests.length > 0) {
      // Show newest (last) pending signature request
      setSelectedSignatureRequest(sigRequests[sigRequests.length - 1]);
      setView("signatureConfirm");
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
      // Only close popup when no more pending requests (not sidepanel)
      if (isInSidePanel) {
        setSelectedTxRequest(null);
        setView("main");
      } else {
        window.close();
      }
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
    // Reject all pending signature requests
    for (const request of pendingSignatureRequests) {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: "rejectSignatureRequest", sigId: request.id },
          () => resolve()
        );
      });
    }
    // Only close popup after rejecting all (not sidepanel)
    if (isInSidePanel) {
      setPendingRequests([]);
      setPendingSignatureRequests([]);
      setSelectedTxRequest(null);
      setSelectedSignatureRequest(null);
      setView("main");
    } else {
      window.close();
    }
  };

  const handleSignatureCancelled = async () => {
    const currentSigId = selectedSignatureRequest?.id;
    const sigRequests = await loadPendingSignatureRequests();

    // Check if more pending signature requests (use fresh data)
    const remaining = sigRequests.filter((r) => r.id !== currentSigId);
    if (remaining.length > 0) {
      setSelectedSignatureRequest(remaining[0]);
    } else {
      // Check if there are pending transaction requests
      const txRequests = await loadPendingRequests();
      if (txRequests.length > 0) {
        setSelectedSignatureRequest(null);
        setSelectedTxRequest(txRequests[0]);
        setView("txConfirm");
      } else if (isInSidePanel) {
        setSelectedSignatureRequest(null);
        setView("main");
      } else {
        window.close();
      }
    }
  };

  const handleCancelAllSignatures = async () => {
    // Cancel all pending signature requests
    for (const request of pendingSignatureRequests) {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: "rejectSignatureRequest", sigId: request.id },
          () => resolve()
        );
      });
    }
    // Check if there are pending transaction requests
    const txRequests = await loadPendingRequests();
    if (txRequests.length > 0) {
      setPendingSignatureRequests([]);
      setSelectedSignatureRequest(null);
      setSelectedTxRequest(txRequests[0]);
      setView("txConfirm");
    } else if (isInSidePanel) {
      setPendingSignatureRequests([]);
      setSelectedSignatureRequest(null);
      setView("main");
    } else {
      window.close();
    }
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
        <Text color="text.secondary" fontWeight="700" textTransform="uppercase" letterSpacing="wider">
          Loading...
        </Text>
      </Box>
    );
  }

  // Unlock screen
  if (view === "unlock") {
    return (
      <UnlockScreen
        onUnlock={handleUnlock}
        pendingTxCount={pendingRequests.length}
        pendingSignatureCount={pendingSignatureRequests.length}
      />
    );
  }

  // Waiting for onboarding to complete
  if (view === "waitingForOnboarding") {
    return (
      <Box
        minH="300px"
        bg="bg.base"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={6}
        textAlign="center"
        position="relative"
      >
        {/* Geometric decorations */}
        <Box
          position="absolute"
          top={4}
          left={4}
          w="12px"
          h="12px"
          bg="bauhaus.red"
          border="2px solid"
          borderColor="bauhaus.black"
        />
        <Box
          position="absolute"
          top={4}
          right={4}
          w="12px"
          h="12px"
          bg="bauhaus.blue"
          border="2px solid"
          borderColor="bauhaus.black"
          borderRadius="full"
        />

        <VStack spacing={4}>
          <Box
            bg="bauhaus.yellow"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            p={3}
          >
            <Image src="impersonatorLogo.png" w="3rem" />
          </Box>
          <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="wider">
            Complete Setup
          </Text>
          <Text fontSize="sm" color="text.secondary" fontWeight="500">
            Please complete the setup in the new tab that just opened.
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              // Re-open or focus onboarding tab
              const onboardingUrl = chrome.runtime.getURL("onboarding.html");
              const existingTabs = await chrome.tabs.query({ url: onboardingUrl });
              if (existingTabs.length > 0 && existingTabs[0].id) {
                await chrome.tabs.update(existingTabs[0].id, { active: true });
                await chrome.windows.update(existingTabs[0].windowId!, { focused: true });
              } else {
                await chrome.tabs.create({ url: onboardingUrl });
              }
            }}
          >
            Open Setup Tab
          </Button>
          <HStack spacing={1} justify="center" mt={4}>
            <Text fontSize="sm" color="text.tertiary" fontWeight="500">
              Built by
            </Text>
            <Link
              display="flex"
              alignItems="center"
              gap={1}
              color="bauhaus.blue"
              fontWeight="700"
              _hover={{ color: "bauhaus.red" }}
              onClick={() => {
                chrome.tabs.create({ url: "https://x.com/apoorveth" });
              }}
            >
              <Box
                as="svg"
                viewBox="0 0 24 24"
                w="14px"
                h="14px"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </Box>
              <Text fontSize="sm" textDecor="underline">
                @apoorveth
              </Text>
            </Link>
          </HStack>
        </VStack>
      </Box>
    );
  }

  // Settings view
  if (view === "settings") {
    return (
      <Box bg="bg.base" h="100%" display="flex" flexDirection="column">
        <Container pt={4} pb={4} flex="1" display="flex" flexDirection="column">
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
            onSessionExpired={() => setView("unlock")}
          />
        </Container>
      </Box>
    );
  }

  // Pending tx list view
  if (view === "pendingTxList") {
    return (
      <PendingTxList
        txRequests={pendingRequests}
        signatureRequests={pendingSignatureRequests}
        onBack={() => setView("main")}
        onSelectTx={(tx) => {
          setSelectedTxRequest(tx);
          setView("txConfirm");
        }}
        onSelectSignature={(sig) => {
          setSelectedSignatureRequest(sig);
          setView("signatureConfirm");
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
    const totalCount = pendingRequests.length + pendingSignatureRequests.length;
    return (
      <TransactionConfirmation
        key={selectedTxRequest.id}
        txRequest={selectedTxRequest}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        totalTxCount={pendingRequests.length}
        totalSignatureCount={pendingSignatureRequests.length}
        isInSidePanel={isInSidePanel}
        onBack={() => {
          if (totalCount > 1) {
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
        onNavigateToSignature={() => {
          if (pendingSignatureRequests.length > 0) {
            setSelectedTxRequest(null);
            setSelectedSignatureRequest(pendingSignatureRequests[0]);
            setView("signatureConfirm");
          }
        }}
      />
    );
  }

  // Signature request confirmation view
  if (view === "signatureConfirm" && selectedSignatureRequest) {
    const currentIndex = pendingSignatureRequests.findIndex(
      (r) => r.id === selectedSignatureRequest.id
    );
    const totalCount = pendingRequests.length + pendingSignatureRequests.length;
    return (
      <SignatureRequestConfirmation
        key={selectedSignatureRequest.id}
        sigRequest={selectedSignatureRequest}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        totalTxCount={pendingRequests.length}
        totalSignatureCount={pendingSignatureRequests.length}
        isInSidePanel={isInSidePanel}
        onBack={() => {
          setSelectedSignatureRequest(null);
          if (totalCount > 1) {
            setView("pendingTxList");
          } else {
            setView("main");
          }
        }}
        onCancelled={handleSignatureCancelled}
        onCancelAll={handleCancelAllSignatures}
        onNavigate={(direction) => {
          const currentIdx = pendingSignatureRequests.findIndex(
            (r) => r.id === selectedSignatureRequest.id
          );
          if (direction === "prev" && currentIdx > 0) {
            setSelectedSignatureRequest(pendingSignatureRequests[currentIdx - 1]);
          } else if (direction === "next" && currentIdx < pendingSignatureRequests.length - 1) {
            setSelectedSignatureRequest(pendingSignatureRequests[currentIdx + 1]);
          }
        }}
        onNavigateToTx={() => {
          if (pendingRequests.length > 0) {
            setSelectedSignatureRequest(null);
            setSelectedTxRequest(pendingRequests[pendingRequests.length - 1]);
            setView("txConfirm");
          }
        }}
      />
    );
  }

  // Main view
  return (
    <Box bg="bg.base" h="100%" display="flex" flexDirection="column">
      {/* Header */}
      <Flex
        py={3}
        px={4}
        bg="bauhaus.black"
        alignItems="center"
        position="relative"
      >
        {/* Decorative stripe */}
        <Box
          position="absolute"
          bottom="0"
          left="0"
          right="0"
          h="3px"
          bg="bauhaus.red"
        />

        <HStack spacing={2}>
          <Box
            bg="bauhaus.white"
            border="2px solid"
            borderColor="bauhaus.black"
            p={1}
          >
            <Image src="impersonatorLogo.png" w="1.5rem" />
          </Box>
          <Text fontWeight="900" color="bauhaus.white" textTransform="uppercase" letterSpacing="wider">
            BankrWallet
          </Text>
        </HStack>
        <Spacer />
        <HStack spacing={1}>
          <Tooltip label="Lock wallet" placement="bottom">
            <IconButton
              aria-label="Lock wallet"
              icon={<LockIcon />}
              variant="ghost"
              size="sm"
              color="bauhaus.white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => {
                chrome.runtime.sendMessage({ type: "lockWallet" }, () => {
                  setView("unlock");
                });
              }}
            />
          </Tooltip>
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
                color="bauhaus.white"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={toggleSidePanelMode}
              />
            </Tooltip>
          )}
          <IconButton
            aria-label="Settings"
            icon={<SettingsIcon />}
            variant="ghost"
            size="sm"
            color="bauhaus.white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => setView("settings")}
          />
        </HStack>
      </Flex>

      <Container pt={4} pb={4} flex="1" display="flex" flexDirection="column">
        <VStack spacing={4} align="stretch" flex="1">
          {/* Failed Transaction Error */}
          {failedTxError && (
            <Box
              bg="bauhaus.red"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              p={3}
              position="relative"
            >
              <HStack w="full" justify="space-between" mb={2}>
                <HStack>
                  <Box p={1} bg="bauhaus.black">
                    <WarningIcon color="bauhaus.red" boxSize={4} />
                  </Box>
                  <Text fontSize="sm" color="white" fontWeight="700">
                    Transaction Failed
                  </Text>
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={() => setFailedTxError(null)}
                >
                  Dismiss
                </Button>
              </HStack>
              <Text fontSize="xs" color="whiteAlpha.800" mb={1} fontWeight="500">
                {failedTxError.origin}
              </Text>
              <Text fontSize="sm" color="white" fontWeight="500">
                {failedTxError.error}
              </Text>
            </Box>
          )}

          {/* Pending Requests Banner */}
          <PendingTxBanner
            txCount={pendingRequests.length}
            signatureCount={pendingSignatureRequests.length}
            onClickTx={() => {
              if (pendingRequests.length === 1) {
                setSelectedTxRequest(pendingRequests[0]);
                setView("txConfirm");
              } else {
                setView("pendingTxList");
              }
            }}
            onClickSignature={() => {
              if (pendingSignatureRequests.length > 0) {
                setSelectedSignatureRequest(pendingSignatureRequests[0]);
                setView("signatureConfirm");
              }
            }}
          />

          {/* Address Display */}
          <Box
            bg="bauhaus.white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            px={4}
            py={3}
            position="relative"
          >
            {/* Corner decoration */}
            <Box
              position="absolute"
              top="-3px"
              right="-3px"
              w="10px"
              h="10px"
              bg="bauhaus.blue"
              border="2px solid"
              borderColor="bauhaus.black"
            />

            {address ? (
              <VStack align="stretch" spacing={1}>
                <Text fontSize="xs" color="text.secondary" fontWeight="700" textTransform="uppercase">
                  Bankr Wallet Address
                </Text>
                <HStack justify="space-between">
                  <HStack
                    bg="bauhaus.black"
                    px={2}
                    py={1}
                    spacing={2}
                  >
                    <Code
                      fontSize="md"
                      fontFamily="mono"
                      bg="transparent"
                      color="bauhaus.white"
                      p={0}
                      fontWeight="700"
                    >
                      {truncateAddress(address)}
                    </Code>
                    <IconButton
                      aria-label="Copy address"
                      icon={copied ? <CheckIcon /> : <CopyIcon />}
                      size="xs"
                      variant="ghost"
                      color={copied ? "bauhaus.yellow" : "bauhaus.white"}
                      onClick={handleCopyAddress}
                      _hover={{ color: "bauhaus.yellow" }}
                      minW="auto"
                      h="auto"
                      p={0}
                    />
                    {chainName && networksInfo && (
                      <IconButton
                        aria-label="View on explorer"
                        icon={<ExternalLinkIcon />}
                        size="xs"
                        variant="ghost"
                        color="bauhaus.white"
                        onClick={() => {
                          const config = getChainConfig(networksInfo[chainName].chainId);
                          if (config.explorer) {
                            chrome.tabs.create({
                              url: `${config.explorer}/address/${address}`,
                            });
                          }
                        }}
                        _hover={{ color: "bauhaus.yellow" }}
                        minW="auto"
                        h="auto"
                        p={0}
                      />
                    )}
                  </HStack>
                  <Box
                    as="button"
                    bg="#FD8464"
                    border="2px solid"
                    borderColor="bauhaus.black"
                    boxShadow="2px 2px 0px 0px #121212"
                    p={1}
                    cursor="pointer"
                    transition="all 0.2s ease-out"
                    _hover={{
                      transform: "translateY(-1px)",
                      boxShadow: "3px 3px 0px 0px #121212",
                    }}
                    _active={{
                      transform: "translate(2px, 2px)",
                      boxShadow: "none",
                    }}
                    onClick={() => {
                      chrome.tabs.create({
                        url: `https://debank.com/profile/${address}`,
                      });
                    }}
                    title="View on DeBank"
                  >
                    <Image src="debank-icon.ico" boxSize="20px" />
                  </Box>
                </HStack>
              </VStack>
            ) : (
              <Text color="text.tertiary" fontSize="sm" textAlign="center" fontWeight="500">
                No address configured
              </Text>
            )}
          </Box>

          {/* Chain Selector */}
          <Menu matchWidth isLazy lazyBehavior="unmount">
            <MenuButton
              as={Button}
              w="full"
              variant="ghost"
              bg="bauhaus.white"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "6px 6px 0px 0px #121212",
              }}
              _active={{
                transform: "translate(2px, 2px)",
                boxShadow: "none",
              }}
              rightIcon={<ChevronDownIcon />}
              textAlign="left"
              fontWeight="700"
              h="auto"
              py={3}
              borderRadius="0"
              transition="all 0.2s ease-out"
            >
              {chainName && networksInfo ? (
                <HStack spacing={2}>
                  {getChainConfig(networksInfo[chainName].chainId).icon && (
                    <Box
                      bg="bauhaus.white"
                      border="2px solid"
                      borderColor="bauhaus.black"
                      p={0.5}
                    >
                      <Image
                        src={getChainConfig(networksInfo[chainName].chainId).icon}
                        alt={chainName}
                        boxSize="18px"
                      />
                    </Box>
                  )}
                  <Text color="text.primary">{chainName}</Text>
                </HStack>
              ) : (
                <Text color="text.tertiary">Select Network</Text>
              )}
            </MenuButton>
            <MenuList
              bg="bauhaus.white"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              borderRadius="0"
              py={0}
            >
              {networksInfo &&
                Object.keys(networksInfo).map((_chainName, i) => {
                  const config = getChainConfig(networksInfo[_chainName].chainId);
                  return (
                    <MenuItem
                      key={i}
                      bg="bauhaus.white"
                      _hover={{ bg: "bg.muted" }}
                      borderBottom={i < Object.keys(networksInfo).length - 1 ? "2px solid" : "none"}
                      borderColor="bauhaus.black"
                      py={3}
                      onClick={() => {
                        if (!chainName) {
                          setReloadRequired(true);
                        }
                        setChainName(_chainName);
                      }}
                    >
                      <HStack spacing={2}>
                        {config.icon && (
                          <Box
                            bg="bauhaus.white"
                            border="2px solid"
                            borderColor="bauhaus.black"
                            p={0.5}
                          >
                            <Image
                              src={config.icon}
                              alt={_chainName}
                              boxSize="18px"
                            />
                          </Box>
                        )}
                        <Text color="text.primary" fontWeight="700">{_chainName}</Text>
                      </HStack>
                    </MenuItem>
                  );
                })}
            </MenuList>
          </Menu>

          {/* Reload Required Alert */}
          {reloadRequired && (
            <Box
              bg="bauhaus.yellow"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              p={3}
            >
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Box p={1} bg="bauhaus.black">
                    <InfoIcon color="bauhaus.yellow" boxSize={4} />
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
                      Reload page required
                    </Text>
                    <Text fontSize="xs" color="bauhaus.black" opacity={0.8} fontWeight="500">
                      To apply changes on the current site
                    </Text>
                  </Box>
                </HStack>
                <Button
                  size="sm"
                  bg="bauhaus.black"
                  color="bauhaus.yellow"
                  _hover={{ opacity: 0.9 }}
                  _active={{ transform: "translate(2px, 2px)" }}
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
              </HStack>
            </Box>
          )}

          {/* Transaction Status List */}
          <TxStatusList maxItems={5} />

          {/* Spacer to push footer to bottom */}
          <Box flex="1" />

          {/* Footer */}
          <HStack spacing={1} justify="center" pt={2}>
            <Text fontSize="sm" color="text.tertiary" fontWeight="500">
              Built by
            </Text>
            <Link
              display="flex"
              alignItems="center"
              gap={1}
              color="bauhaus.blue"
              fontWeight="700"
              _hover={{ color: "bauhaus.red" }}
              onClick={() => {
                chrome.tabs.create({ url: "https://x.com/apoorveth" });
              }}
            >
              <Box
                as="svg"
                viewBox="0 0 24 24"
                w="14px"
                h="14px"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </Box>
              <Text fontSize="sm" textDecor="underline">
                @apoorveth
              </Text>
            </Link>
          </HStack>
        </VStack>
      </Container>
    </Box>
  );
}

export default App;
