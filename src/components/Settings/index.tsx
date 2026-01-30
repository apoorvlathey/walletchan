import { useState, useEffect } from "react";
import {
  HStack,
  VStack,
  Text,
  Link,
  Box,
  Button,
  Divider,
  Badge,
  IconButton,
  Heading,
  Spacer,
  Code,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import {
  ArrowBackIcon,
  WarningIcon,
  LockIcon,
  ChevronRightIcon,
  DeleteIcon,
} from "@chakra-ui/icons";
import Chains from "./Chains";
import ChangePassword from "./ChangePassword";
import ApiKeySetup from "@/pages/ApiKeySetup";
import { hasEncryptedApiKey } from "@/chrome/crypto";

type SettingsTab = "main" | "apiKey" | "chains" | "changePassword";

interface SettingsProps {
  close: () => void;
  showBackButton?: boolean;
}

function Settings({ close, showBackButton = true }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>("main");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [address, setAddress] = useState<string>("");
  const toast = useToast();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();

  const handleClearHistory = () => {
    chrome.runtime.sendMessage({ type: "clearTxHistory" }, () => {
      toast({
        title: "Transaction history cleared",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      onDeleteModalClose();
    });
  };

  useEffect(() => {
    checkApiKey();
    loadAddress();
  }, []);

  const checkApiKey = async () => {
    const exists = await hasEncryptedApiKey();
    setHasApiKey(exists);
  };

  const loadAddress = async () => {
    const { address: storedAddress } = (await chrome.storage.sync.get("address")) as {
      address?: string;
    };
    if (storedAddress) {
      setAddress(storedAddress);
    }
  };

  const truncateAddress = (addr: string): string => {
    if (!addr) return "Not set";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (tab === "apiKey") {
    return (
      <ApiKeySetup
        onComplete={() => {
          checkApiKey();
          loadAddress();
          setTab("main");
        }}
        onCancel={() => setTab("main")}
        isChangingKey={hasApiKey}
      />
    );
  }

  if (tab === "chains") {
    return <Chains close={() => setTab("main")} />;
  }

  if (tab === "changePassword") {
    return (
      <ChangePassword
        onComplete={() => setTab("main")}
        onCancel={() => setTab("main")}
      />
    );
  }

  return (
    <VStack spacing={4} align="stretch" flex="1">
      {/* Header */}
      <HStack>
        {showBackButton && (
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={close}
          />
        )}
        <Heading size="sm" color="text.primary">
          Settings
        </Heading>
        <Spacer />
      </HStack>

      {/* API Key & Wallet Section - Warning Style */}
      <Box
        bg="warning.bg"
        borderWidth="1px"
        borderColor="warning.border"
        borderRadius="lg"
        p={4}
      >
        <HStack spacing={3} mb={3}>
          <Box p={2} bg="warning.solid" borderRadius="md">
            <WarningIcon boxSize={4} color="bg.base" />
          </Box>
          <Box>
            <Text fontWeight="600" color="text.primary">
              API Key & Wallet
            </Text>
            <Text fontSize="xs" color="text.secondary">
              Your API key and wallet address are linked
            </Text>
          </Box>
        </HStack>

        <VStack spacing={2} align="stretch" mb={3}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="text.secondary">
              API Key
            </Text>
            {hasApiKey ? (
              <Badge variant="success" fontSize="xs">
                Configured
              </Badge>
            ) : (
              <Badge variant="error" fontSize="xs">
                Not set
              </Badge>
            )}
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="text.secondary">
              Address
            </Text>
            <Code fontSize="xs" bg="transparent" color="text.primary">
              {truncateAddress(address)}
            </Code>
          </HStack>
        </VStack>

        <Button
          size="sm"
          variant="outline"
          w="full"
          borderColor="warning.solid"
          color="warning.solid"
          _hover={{ bg: "rgba(251,191,36,0.15)" }}
          onClick={() => setTab("apiKey")}
        >
          {hasApiKey ? "Change API Key & Address" : "Configure API Key & Address"}
        </Button>
      </Box>

      {/* Change Password Section */}
      {hasApiKey && (
        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="lg"
          p={4}
          cursor="pointer"
          onClick={() => setTab("changePassword")}
          _hover={{
            bg: "bg.emphasis",
            borderColor: "border.strong",
          }}
          transition="all 0.2s"
        >
          <HStack justify="space-between">
            <HStack spacing={3}>
              <Box p={2} bg="bg.muted" borderRadius="md">
                <LockIcon boxSize={4} color="primary.400" />
              </Box>
              <Box>
                <Text fontWeight="500" color="text.primary">
                  Change Password
                </Text>
                <Text fontSize="xs" color="text.secondary">
                  Update your encryption password
                </Text>
              </Box>
            </HStack>
            <ChevronRightIcon color="text.tertiary" />
          </HStack>
        </Box>
      )}

      {/* Chain RPCs Section */}
      <Box
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="lg"
        p={4}
        cursor="pointer"
        onClick={() => setTab("chains")}
        _hover={{
          bg: "bg.emphasis",
          borderColor: "border.strong",
        }}
        transition="all 0.2s"
      >
        <HStack justify="space-between">
          <HStack spacing={3}>
            <Box p={2} bg="bg.muted" borderRadius="md">
              <Text fontSize="lg">⛓️</Text>
            </Box>
            <Box>
              <Text fontWeight="500" color="text.primary">
                Chain RPCs
              </Text>
              <Text fontSize="xs" color="text.secondary">
                Configure network RPC endpoints
              </Text>
            </Box>
          </HStack>
          <ChevronRightIcon color="text.tertiary" />
        </HStack>
      </Box>

      {/* Clear Transaction History Section */}
      <Box
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="lg"
        p={4}
        cursor="pointer"
        onClick={onDeleteModalOpen}
        _hover={{
          bg: "bg.emphasis",
          borderColor: "border.strong",
        }}
        transition="all 0.2s"
      >
        <HStack justify="space-between">
          <HStack spacing={3}>
            <Box p={2} bg="bg.muted" borderRadius="md">
              <DeleteIcon boxSize={4} color="text.secondary" />
            </Box>
            <Box>
              <Text fontWeight="500" color="text.primary">
                Clear Transaction History
              </Text>
              <Text fontSize="xs" color="text.secondary">
                Remove all transaction records
              </Text>
            </Box>
          </HStack>
        </HStack>
      </Box>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg="bg.subtle" borderWidth="1px" borderColor="border.default" mx={4}>
          <ModalHeader color="text.primary" fontSize="md">
            Clear Transaction History?
          </ModalHeader>
          <ModalBody>
            <Text color="text.secondary" fontSize="sm">
              This will permanently delete all transaction records. This action cannot be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" size="sm" onClick={onDeleteModalClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              bg="error.solid"
              color="white"
              _hover={{ bg: "error.solid", opacity: 0.9 }}
              onClick={handleClearHistory}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Spacer to push footer to bottom */}
      <Box flex="1" />

      <Divider borderColor="border.default" />

      <HStack spacing={1} justify="center">
        <Text fontSize="sm" color="text.tertiary">
          Built by
        </Text>
        <Link
          display="flex"
          alignItems="center"
          gap={1}
          color="primary.400"
          _hover={{ color: "primary.500" }}
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
  );
}

export default Settings;
