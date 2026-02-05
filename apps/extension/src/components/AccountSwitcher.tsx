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
  Icon,
} from "@chakra-ui/react";
import { ChevronDownIcon, AddIcon } from "@chakra-ui/icons";
import type { Account } from "@/chrome/types";

// Robot icon for Bankr accounts
const RobotIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"
    />
  </Icon>
);

// Key icon for Private Key accounts
const KeyIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm14 8.5l-5.5-5.5.71-.71L17.5 11l-.71-.71-2.5 2.5-2.29-2.29-.71.71.71.71-2 2V14H9v1H8v1H7v1H4v-1l7-7c-.55-.89-.95-1.89-1-3H7c0-2.76 2.24-5 5-5 2.21 0 4.05 1.43 4.71 3.42l.79.79 1.79-1.79.71.71-.71.71 1.79 1.79.71-.71-.71-.71 1.71-1.71 1.5 1.5-8 8-1.29-1.29z"
    />
  </Icon>
);

interface AccountSwitcherProps {
  accounts: Account[];
  activeAccount: Account | null;
  onAccountSelect: (account: Account) => void;
  onAddAccount: () => void;
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
            <Box
              bg={activeAccount.type === "bankr" ? "bauhaus.blue" : "bauhaus.yellow"}
              border="2px solid"
              borderColor="bauhaus.black"
              p={1}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {activeAccount.type === "bankr" ? (
                <RobotIcon boxSize="16px" color="white" />
              ) : (
                <KeyIcon boxSize="16px" color="bauhaus.black" />
              )}
            </Box>
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
              <Box
                bg={account.type === "bankr" ? "bauhaus.blue" : "bauhaus.yellow"}
                border="2px solid"
                borderColor="bauhaus.black"
                p={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {account.type === "bankr" ? (
                  <RobotIcon boxSize="14px" color="white" />
                ) : (
                  <KeyIcon boxSize="14px" color="bauhaus.black" />
                )}
              </Box>
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
