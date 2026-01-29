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
} from "@chakra-ui/react";
import { CheckIcon, SettingsIcon } from "@chakra-ui/icons";
import Chains from "./Chains";
import ApiKeySetup from "@/pages/ApiKeySetup";
import { hasEncryptedApiKey, removeEncryptedApiKey } from "@/chrome/crypto";

type SettingsTab = "main" | "apiKey";

function Settings({ close }: { close: () => void }) {
  const [tab, setTab] = useState<SettingsTab>("main");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const exists = await hasEncryptedApiKey();
    setHasApiKey(exists);
  };

  const handleRemoveApiKey = async () => {
    if (confirm("Are you sure you want to remove your API key?")) {
      await removeEncryptedApiKey();
      // Clear the cached API key in background
      await chrome.runtime.sendMessage({ type: "clearApiKeyCache" });
      setHasApiKey(false);
    }
  };

  if (tab === "apiKey") {
    return (
      <ApiKeySetup
        onComplete={() => {
          checkApiKey();
          setTab("main");
        }}
        onCancel={() => setTab("main")}
        isChangingKey={hasApiKey}
      />
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      <Chains close={close} />

      <Divider />

      {/* API Key Section */}
      <Box>
        <Text fontWeight="medium" mb={2}>
          Bankr API Key
        </Text>

        {hasApiKey ? (
          <VStack spacing={2} align="stretch">
            <HStack>
              <Badge colorScheme="green" display="flex" alignItems="center">
                <CheckIcon mr={1} boxSize={3} />
                Configured
              </Badge>
            </HStack>
            <HStack spacing={2}>
              <Button
                size="sm"
                leftIcon={<SettingsIcon />}
                onClick={() => setTab("apiKey")}
              >
                Change Key
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorScheme="red"
                onClick={handleRemoveApiKey}
              >
                Remove
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack spacing={2} align="stretch">
            <Text fontSize="sm" color="gray.400">
              Configure your API key to enable transaction signing.
            </Text>
            <Button size="sm" colorScheme="blue" onClick={() => setTab("apiKey")}>
              Configure API Key
            </Button>
          </VStack>
        )}
      </Box>

      <Divider />

      <HStack>
        <Text>Built by:</Text>
        <Link
          textDecor={"underline"}
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
