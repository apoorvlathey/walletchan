import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { SettingsIcon, DeleteIcon, ViewIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import type { Account } from "@/chrome/types";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onRevealPrivateKey: (account: Account) => void;
  onAccountUpdated: () => void;
}

type ModalView = "settings" | "confirmDelete";

function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onRevealPrivateKey,
  onAccountUpdated,
}: AccountSettingsModalProps) {
  const toast = useBauhausToast();
  const [view, setView] = useState<ModalView>("settings");
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset state when modal opens/account changes
  useEffect(() => {
    if (isOpen && account) {
      setDisplayName(account.displayName || "");
      setView("settings");
    }
  }, [isOpen, account]);

  const handleClose = () => {
    setView("settings");
    setDisplayName("");
    setIsSaving(false);
    setIsDeleting(false);
    onClose();
  };

  const handleSaveDisplayName = async () => {
    if (!account) return;

    const trimmedName = displayName.trim();
    if (trimmedName === (account.displayName || "")) {
      // No change
      return;
    }

    setIsSaving(true);

    chrome.runtime.sendMessage(
      {
        type: "updateAccountDisplayName",
        accountId: account.id,
        displayName: trimmedName || undefined
      },
      (result: { success: boolean; error?: string }) => {
        setIsSaving(false);
        if (result.success) {
          toast({
            title: "Display name updated",
            status: "success",
            duration: 2000,
          });
          onAccountUpdated();
        } else {
          toast({
            title: "Failed to update",
            description: result.error,
            status: "error",
            duration: 3000,
          });
        }
      }
    );
  };

  const handleRevealKey = () => {
    if (account) {
      handleClose();
      onRevealPrivateKey(account);
    }
  };

  const handleDeleteAccount = async () => {
    if (!account) return;

    setIsDeleting(true);

    chrome.runtime.sendMessage(
      { type: "removeAccount", accountId: account.id },
      (result: { success: boolean; error?: string }) => {
        setIsDeleting(false);
        if (result.success) {
          toast({
            title: "Account removed",
            status: "success",
            duration: 2000,
          });
          handleClose();
          onAccountUpdated();
        } else {
          toast({
            title: "Failed to remove account",
            description: result.error,
            status: "error",
            duration: 3000,
          });
        }
      }
    );
  };

  if (!account) return null;

  // Confirmation view for delete
  if (view === "confirmDelete") {
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
              <Box p={1} bg="bauhaus.red" border="2px solid" borderColor="bauhaus.black">
                <WarningTwoIcon color="white" />
              </Box>
              Remove Account?
            </Box>
          </ModalHeader>

          <ModalBody>
            <VStack spacing={3} align="stretch">
              <Text color="text.secondary" fontSize="sm" fontWeight="500">
                Are you sure you want to remove this account?
              </Text>

              <Box
                p={3}
                bg="bg.muted"
                border="2px solid"
                borderColor="bauhaus.black"
              >
                <Text fontSize="sm" fontWeight="700" color="text.primary">
                  {account.displayName || truncateAddress(account.address)}
                </Text>
                <Text fontSize="xs" fontFamily="mono" color="text.tertiary">
                  {account.address}
                </Text>
              </Box>

              {account.type === "privateKey" && (
                <Box
                  w="full"
                  p={3}
                  bg="bauhaus.red"
                  border="2px solid"
                  borderColor="bauhaus.black"
                >
                  <Text color="white" fontSize="sm" fontWeight="700">
                    Make sure you have backed up your private key before removing this account!
                  </Text>
                </Box>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter gap={2}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setView("settings")}
              isDisabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              isLoading={isDeleting}
              loadingText="Removing..."
            >
              Remove Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  // Main settings view
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
            <Box p={1} bg="bauhaus.blue" border="2px solid" borderColor="bauhaus.black">
              <SettingsIcon color="white" />
            </Box>
            Account Settings
          </Box>
        </ModalHeader>

        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Account Info */}
            <Box
              p={3}
              bg="bg.muted"
              border="2px solid"
              borderColor="bauhaus.black"
            >
              <Text fontSize="xs" fontFamily="mono" color="text.tertiary">
                {account.address}
              </Text>
              <HStack mt={1} spacing={2}>
                <Box
                  w={2}
                  h={2}
                  bg={account.type === "privateKey" ? "bauhaus.yellow" : "bauhaus.blue"}
                  border="1px solid"
                  borderColor="bauhaus.black"
                  borderRadius={account.type === "privateKey" ? "none" : "full"}
                />
                <Text fontSize="xs" color="text.tertiary" fontWeight="600" textTransform="uppercase">
                  {account.type === "privateKey" ? "Private Key Account" : "Bankr Account"}
                </Text>
              </HStack>
            </Box>

            {/* Display Name */}
            <FormControl>
              <FormLabel
                fontSize="xs"
                fontWeight="700"
                color="text.primary"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Display Name
              </FormLabel>
              <HStack spacing={3}>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter a name..."
                  bg="white"
                  border="3px solid"
                  borderColor="bauhaus.black"
                  borderRadius="0"
                  size="md"
                  _focus={{
                    borderColor: "bauhaus.blue",
                    boxShadow: "none",
                  }}
                  _hover={{
                    borderColor: "bauhaus.black",
                  }}
                />
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSaveDisplayName}
                  isLoading={isSaving}
                  isDisabled={displayName.trim() === (account.displayName || "")}
                  minW="70px"
                >
                  Save
                </Button>
              </HStack>
            </FormControl>

            {/* Actions */}
            <VStack spacing={3} align="stretch" pt={2}>
              {account.type === "privateKey" && (
                <Button
                  variant="yellow"
                  size="sm"
                  leftIcon={<ViewIcon />}
                  onClick={handleRevealKey}
                  justifyContent="flex-start"
                  w="full"
                >
                  Reveal Private Key
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                leftIcon={<DeleteIcon color="bauhaus.red" />}
                onClick={() => setView("confirmDelete")}
                justifyContent="flex-start"
                color="bauhaus.red"
                fontWeight="700"
                border="2px solid transparent"
                _hover={{
                  bg: "red.50",
                  borderColor: "bauhaus.red",
                }}
                w="full"
              >
                Remove Account
              </Button>
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" size="md" onClick={handleClose}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default memo(AccountSettingsModal);
