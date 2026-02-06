import { useState, useRef, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  InputGroup,
  InputRightElement,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Code,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, WarningTwoIcon, CopyIcon, CheckIcon } from "@chakra-ui/icons";
import type { Account } from "@/chrome/types";

interface RevealPrivateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

function RevealPrivateKeyModal({ isOpen, onClose, account }: RevealPrivateKeyModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus password input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clear state on close
  const handleClose = () => {
    setPassword("");
    setShowPassword(false);
    setShowKey(false);
    setPrivateKey("");
    setError("");
    setIsLoading(false);
    setCopied(false);
    onClose();
  };

  const handleReveal = () => {
    if (!password || !account) return;
    setError("");
    setIsLoading(true);

    chrome.runtime.sendMessage(
      { type: "revealPrivateKey", accountId: account.id, password },
      (result: { success: boolean; privateKey?: string; error?: string }) => {
        setIsLoading(false);
        if (result.success && result.privateKey) {
          setPrivateKey(result.privateKey);
        } else {
          setError(result.error || "Failed to reveal private key");
        }
      }
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for extension context
      const textarea = document.createElement("textarea");
      textarea.value = privateKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const revealed = !!privateKey;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent
        bg="bauhaus.white"
        border="4px solid"
        borderColor="bauhaus.black"
        borderRadius="0"
        boxShadow="8px 8px 0px 0px #121212"
        mx={4}
      >
        <ModalHeader color="text.primary" fontSize="md" pb={2} textTransform="uppercase" letterSpacing="wider">
          <Box display="flex" alignItems="center" gap={2}>
            <Box p={1} bg="bauhaus.yellow" border="2px solid" borderColor="bauhaus.black">
              <WarningTwoIcon color="bauhaus.black" />
            </Box>
            Reveal Private Key
          </Box>
        </ModalHeader>

        <ModalBody>
          {!revealed ? (
            <VStack spacing={3} align="stretch">
              <Box
                w="full"
                p={3}
                bg="bauhaus.red"
                border="2px solid"
                borderColor="bauhaus.black"
              >
                <Text color="white" fontSize="sm" fontWeight="700">
                  Never share your private key. Anyone with it has full control of your wallet.
                </Text>
              </Box>

              <Text color="text.secondary" fontSize="sm" fontWeight="500">
                Enter your password to reveal the private key for{" "}
                <Text as="span" fontWeight="700" color="text.primary">
                  {account?.displayName || truncateAddress(account?.address || "")}
                </Text>
              </Text>

              <InputGroup>
                <Input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReveal();
                  }}
                  bg="white"
                  border="3px solid"
                  borderColor={error ? "bauhaus.red" : "bauhaus.black"}
                  borderRadius="0"
                  _focus={{
                    borderColor: error ? "bauhaus.red" : "bauhaus.blue",
                    boxShadow: "none",
                  }}
                  _hover={{
                    borderColor: error ? "bauhaus.red" : "bauhaus.black",
                  }}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    color="text.secondary"
                  />
                </InputRightElement>
              </InputGroup>

              {error && (
                <Text color="bauhaus.red" fontSize="sm" fontWeight="600">
                  {error}
                </Text>
              )}
            </VStack>
          ) : (
            <VStack spacing={3} align="stretch">
              <Box
                w="full"
                p={3}
                bg="bauhaus.red"
                border="2px solid"
                borderColor="bauhaus.black"
              >
                <Text color="white" fontSize="sm" fontWeight="700">
                  Do not share this key. Anyone with it can steal your funds.
                </Text>
              </Box>

              <Box
                w="full"
                p={3}
                bg="gray.50"
                border="3px solid"
                borderColor="bauhaus.black"
                position="relative"
              >
                <Code
                  fontSize="xs"
                  fontFamily="mono"
                  wordBreak="break-all"
                  bg="transparent"
                  color="text.primary"
                  fontWeight="600"
                >
                  {showKey ? privateKey : "•".repeat(66)}
                </Code>
              </Box>

              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={showKey ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowKey(!showKey)}
                  flex={1}
                >
                  {showKey ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
                  onClick={handleCopy}
                  flex={1}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </HStack>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter gap={2}>
          {!revealed ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReveal}
                isLoading={isLoading}
                loadingText="Verifying..."
                isDisabled={!password}
              >
                Reveal
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleClose} w="full">
              Done
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default memo(RevealPrivateKeyModal);
