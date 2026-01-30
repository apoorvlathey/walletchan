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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { useBauhausToast } from "@/hooks/useBauhausToast";
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
  onSessionExpired?: () => void;
}

function Settings({ close, showBackButton = true, onSessionExpired }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>("main");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [address, setAddress] = useState<string>("");
  const toast = useBauhausToast();
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
        onSessionExpired={onSessionExpired || (() => setTab("main"))}
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
        <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="tight">
          Settings
        </Text>
        <Spacer />
      </HStack>

      {/* API Key & Wallet Section - Warning Style */}
      <Box
        bg="bauhaus.yellow"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        p={4}
        position="relative"
      >
        {/* Corner decoration */}
        <Box
          position="absolute"
          top="-3px"
          right="-3px"
          w="10px"
          h="10px"
          bg="bauhaus.red"
          border="2px solid"
          borderColor="bauhaus.black"
        />

        <HStack spacing={3} mb={3}>
          <Box p={2} bg="bauhaus.black">
            <WarningIcon boxSize={4} color="bauhaus.yellow" />
          </Box>
          <Box>
            <Text fontWeight="700" color="bauhaus.black">
              API Key & Wallet
            </Text>
            <Text fontSize="xs" color="bauhaus.black" opacity={0.8}>
              Your API key and wallet address are linked
            </Text>
          </Box>
        </HStack>

        <VStack spacing={2} align="stretch" mb={3}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="bauhaus.black" fontWeight="500">
              API Key
            </Text>
            {hasApiKey ? (
              <Badge
                bg="bauhaus.black"
                color="bauhaus.yellow"
                border="2px solid"
                borderColor="bauhaus.black"
                fontSize="xs"
                fontWeight="700"
              >
                Configured
              </Badge>
            ) : (
              <Badge
                bg="bauhaus.red"
                color="white"
                border="2px solid"
                borderColor="bauhaus.black"
                fontSize="xs"
                fontWeight="700"
              >
                Not set
              </Badge>
            )}
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="bauhaus.black" fontWeight="500">
              Address
            </Text>
            <Code
              fontSize="xs"
              bg="bauhaus.white"
              color="bauhaus.black"
              border="2px solid"
              borderColor="bauhaus.black"
              px={2}
              fontWeight="700"
            >
              {truncateAddress(address)}
            </Code>
          </HStack>
        </VStack>

        <Button
          size="sm"
          w="full"
          bg="bauhaus.black"
          color="bauhaus.yellow"
          border="2px solid"
          borderColor="bauhaus.black"
          fontWeight="700"
          _hover={{ bg: "bauhaus.black", opacity: 0.9 }}
          _active={{ transform: "translate(2px, 2px)" }}
          onClick={() => setTab("apiKey")}
        >
          {hasApiKey ? "Change API Key & Address" : "Configure API Key & Address"}
        </Button>
      </Box>

      {/* Change Password Section */}
      {hasApiKey && (
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={4}
          cursor="pointer"
          onClick={() => setTab("changePassword")}
          _hover={{
            transform: "translateY(-2px)",
            boxShadow: "6px 6px 0px 0px #121212",
          }}
          _active={{
            transform: "translate(2px, 2px)",
            boxShadow: "none",
          }}
          transition="all 0.2s ease-out"
          position="relative"
        >
          {/* Corner decoration */}
          <Box
            position="absolute"
            top="-3px"
            right="-3px"
            w="8px"
            h="8px"
            bg="bauhaus.blue"
            border="2px solid"
            borderColor="bauhaus.black"
          />

          <HStack justify="space-between">
            <HStack spacing={3}>
              <Box p={2} bg="bauhaus.blue">
                <LockIcon boxSize={4} color="white" />
              </Box>
              <Box>
                <Text fontWeight="700" color="text.primary">
                  Change Password
                </Text>
                <Text fontSize="xs" color="text.secondary" fontWeight="500">
                  Update your encryption password
                </Text>
              </Box>
            </HStack>
            <Box bg="bauhaus.black" p={1}>
              <ChevronRightIcon color="bauhaus.white" />
            </Box>
          </HStack>
        </Box>
      )}

      {/* Chain RPCs Section */}
      <Box
        bg="bauhaus.white"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        p={4}
        cursor="pointer"
        onClick={() => setTab("chains")}
        _hover={{
          transform: "translateY(-2px)",
          boxShadow: "6px 6px 0px 0px #121212",
        }}
        _active={{
          transform: "translate(2px, 2px)",
          boxShadow: "none",
        }}
        transition="all 0.2s ease-out"
        position="relative"
      >
        {/* Corner decoration */}
        <Box
          position="absolute"
          top="-3px"
          right="-3px"
          w="8px"
          h="8px"
          bg="bauhaus.yellow"
          border="2px solid"
          borderColor="bauhaus.black"
        />

        <HStack justify="space-between">
          <HStack spacing={3}>
            <Box p={2} bg="bauhaus.black">
              <Text fontSize="lg">⛓️</Text>
            </Box>
            <Box>
              <Text fontWeight="700" color="text.primary">
                Chain RPCs
              </Text>
              <Text fontSize="xs" color="text.secondary" fontWeight="500">
                Configure network RPC endpoints
              </Text>
            </Box>
          </HStack>
          <Box bg="bauhaus.black" p={1}>
            <ChevronRightIcon color="bauhaus.white" />
          </Box>
        </HStack>
      </Box>

      {/* Clear Transaction History Section */}
      <Box
        bg="bauhaus.white"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        p={4}
        cursor="pointer"
        onClick={onDeleteModalOpen}
        _hover={{
          transform: "translateY(-2px)",
          boxShadow: "6px 6px 0px 0px #121212",
        }}
        _active={{
          transform: "translate(2px, 2px)",
          boxShadow: "none",
        }}
        transition="all 0.2s ease-out"
        position="relative"
      >
        {/* Corner decoration */}
        <Box
          position="absolute"
          top="-3px"
          right="-3px"
          w="8px"
          h="8px"
          bg="bauhaus.red"
          border="2px solid"
          borderColor="bauhaus.black"
        />

        <HStack justify="space-between">
          <HStack spacing={3}>
            <Box p={2} bg="bauhaus.red">
              <DeleteIcon boxSize={4} color="white" />
            </Box>
            <Box>
              <Text fontWeight="700" color="text.primary">
                Clear Transaction History
              </Text>
              <Text fontSize="xs" color="text.secondary" fontWeight="500">
                Remove all transaction records
              </Text>
            </Box>
          </HStack>
        </HStack>
      </Box>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="8px 8px 0px 0px #121212"
          mx={4}
          borderRadius="0"
        >
          <ModalHeader
            color="bauhaus.black"
            fontWeight="900"
            fontSize="md"
            textTransform="uppercase"
            borderBottom="3px solid"
            borderColor="bauhaus.black"
          >
            Clear Transaction History?
          </ModalHeader>
          <ModalBody py={4}>
            <Text color="text.secondary" fontSize="sm" fontWeight="500">
              This will permanently delete all transaction records. This action cannot be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap={2} borderTop="3px solid" borderColor="bauhaus.black">
            <Button variant="secondary" size="sm" onClick={onDeleteModalClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearHistory}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Spacer to push footer to bottom */}
      <Box flex="1" />

      <Box h="3px" bg="bauhaus.black" w="full" />

      <HStack spacing={1} justify="center">
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
  );
}

export default Settings;
