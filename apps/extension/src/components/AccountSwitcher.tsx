import { memo } from "react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Button,
  HStack,
  VStack,
  Text,
  Box,
  Image,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { ChevronDownIcon, AddIcon, SettingsIcon } from "@chakra-ui/icons";
import { blo } from "blo";
import type { Account } from "@/chrome/types";

// Blockies avatar for PK accounts using blo
function BlockieAvatar({ address, size = 20 }: { address: string; size?: number }) {
  const bloAvatar = blo(address as `0x${string}`);
  return (
    <Image
      src={bloAvatar}
      alt="Account avatar"
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="sm"
      border="2px solid"
      borderColor="bauhaus.black"
    />
  );
}

// BankrWallet icon for Bankr API accounts
function BankrAvatar({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/bankrwallet-icon.png"
      alt="Bankr account"
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="sm"
      border="2px solid"
      borderColor="bauhaus.black"
    />
  );
}

interface AccountSwitcherProps {
  accounts: Account[];
  activeAccount: Account | null;
  onAccountSelect: (account: Account) => void;
  onAddAccount: () => void;
  onAccountSettings: (account: Account) => void;
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function AccountSwitcher({
  accounts,
  activeAccount,
  onAccountSelect,
  onAddAccount,
  onAccountSettings,
}: AccountSwitcherProps) {
  return (
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
        {activeAccount ? (
          <HStack spacing={2}>
            {activeAccount.type === "bankr" ? (
              <BankrAvatar size={24} />
            ) : (
              <BlockieAvatar address={activeAccount.address} size={24} />
            )}
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" color="text.primary" fontWeight="700">
                {activeAccount.displayName || truncateAddress(activeAccount.address)}
              </Text>
              {activeAccount.displayName && (
                <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                  {truncateAddress(activeAccount.address)}
                </Text>
              )}
            </VStack>
          </HStack>
        ) : (
          <Text color="text.tertiary">Select Account</Text>
        )}
      </MenuButton>
      <MenuList
        bg="bauhaus.white"
        border="3px solid"
        borderColor="bauhaus.black"
        boxShadow="4px 4px 0px 0px #121212"
        borderRadius="0"
        py={0}
        maxH="300px"
        overflowY="auto"
      >
        {accounts.map((account, i) => (
          <MenuItem
            key={account.id}
            bg={account.id === activeAccount?.id ? "bg.muted" : "bauhaus.white"}
            _hover={{ bg: "bg.muted" }}
            borderBottom={i < accounts.length - 1 ? "2px solid" : "none"}
            borderColor="bauhaus.black"
            py={3}
            onClick={() => onAccountSelect(account)}
          >
            <HStack spacing={3} w="full">
              {account.type === "bankr" ? (
                <BankrAvatar size={24} />
              ) : (
                <BlockieAvatar address={account.address} size={24} />
              )}
              <VStack align="start" spacing={0} flex={1}>
                <Text fontSize="sm" color="text.primary" fontWeight="700">
                  {account.displayName || truncateAddress(account.address)}
                </Text>
                {account.displayName && (
                  <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                    {truncateAddress(account.address)}
                  </Text>
                )}
              </VStack>
              <Tooltip label="Account Settings" hasArrow placement="top">
                <IconButton
                  aria-label="Account Settings"
                  icon={<SettingsIcon boxSize="12px" />}
                  size="xs"
                  variant="ghost"
                  color="text.secondary"
                  _hover={{ color: "bauhaus.blue", bg: "transparent" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccountSettings(account);
                  }}
                />
              </Tooltip>
              {account.id === activeAccount?.id && (
                <Box
                  w="8px"
                  h="8px"
                  bg="bauhaus.green"
                  borderRadius="full"
                  border="2px solid"
                  borderColor="bauhaus.black"
                />
              )}
            </HStack>
          </MenuItem>
        ))}
        <MenuDivider m={0} borderColor="bauhaus.black" borderWidth="2px" />
        <MenuItem
          bg="bauhaus.white"
          _hover={{ bg: "bg.muted" }}
          py={3}
          onClick={onAddAccount}
        >
          <HStack spacing={3}>
            <Box
              bg="bauhaus.red"
              border="2px solid"
              borderColor="bauhaus.black"
              p={1}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <AddIcon boxSize="14px" color="white" />
            </Box>
            <Text fontSize="sm" color="text.primary" fontWeight="700">
              Add Account
            </Text>
          </HStack>
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

export default memo(AccountSwitcher);
