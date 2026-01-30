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
} from "@chakra-ui/react";
import {
  ArrowBackIcon,
  WarningIcon,
  LockIcon,
  ChevronRightIcon,
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
    <VStack spacing={4} align="stretch">
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

      <Divider borderColor="border.default" />

      <HStack>
        <Text fontSize="sm" color="text.tertiary">
          Built by:
        </Text>
        <Link
          fontSize="sm"
          color="primary.400"
          textDecor="underline"
          _hover={{ color: "primary.500" }}
          onClick={() => {
            chrome.tabs.create({ url: "https://twitter.com/apoorveth" });
          }}
        >
          Apoorv Lathey
        </Link>
      </HStack>
    </VStack>
  );
}

export default Settings;
