import {
  Flex,
  HStack,
  Text,
  IconButton,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { ArrowBackIcon, AddIcon, DeleteIcon, HamburgerIcon } from "@chakra-ui/icons";

interface ChatHeaderProps {
  title: string;
  onBack: () => void;
  onNewChat: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
}

export function ChatHeader({
  title,
  onBack,
  onNewChat,
  onDelete,
  showDelete = true,
}: ChatHeaderProps) {
  return (
    <Flex
      py={2}
      px={3}
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
        h="2px"
        bg="bauhaus.yellow"
      />

      <IconButton
        aria-label="Back"
        icon={<ArrowBackIcon />}
        variant="ghost"
        size="sm"
        color="bauhaus.white"
        _hover={{ bg: "whiteAlpha.200" }}
        onClick={onBack}
        mr={2}
      />

      <Text
        fontWeight="700"
        color="bauhaus.white"
        fontSize="sm"
        flex="1"
        isTruncated
        textTransform="uppercase"
        letterSpacing="wide"
      >
        {title}
      </Text>

      <HStack spacing={1}>
        <IconButton
          aria-label="New chat"
          icon={<AddIcon />}
          variant="ghost"
          size="sm"
          color="bauhaus.white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onNewChat}
        />

        {showDelete && onDelete && (
          <Menu isLazy>
            <MenuButton
              as={IconButton}
              aria-label="More options"
              icon={<HamburgerIcon />}
              variant="ghost"
              size="sm"
              color="bauhaus.white"
              _hover={{ bg: "whiteAlpha.200" }}
            />
            <MenuList
              bg="bauhaus.white"
              border="3px solid"
              borderColor="bauhaus.black"
              boxShadow="4px 4px 0px 0px #121212"
              borderRadius="0"
              py={0}
              minW="150px"
            >
              <MenuItem
                icon={<DeleteIcon color="bauhaus.red" />}
                bg="bauhaus.white"
                _hover={{ bg: "bg.muted" }}
                color="bauhaus.red"
                fontWeight="700"
                onClick={onDelete}
              >
                Delete Chat
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </HStack>
    </Flex>
  );
}

export default ChatHeader;
