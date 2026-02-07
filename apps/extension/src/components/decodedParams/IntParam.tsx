import { useState, useRef, useEffect } from "react";
import { HStack, Text, Button, Tooltip, Box, VStack } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { CopyButton } from "@/components/CopyButton";
import {
  ethFormatOptions,
  ETHSelectedOption,
  convertTo,
} from "@/lib/convertUtils";

interface IntParamProps {
  value: string;
}

export function IntParam({ value }: IntParamProps) {
  const [selectedOption, setSelectedOption] = useState<ETHSelectedOption>("Wei");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const converted = convertTo(value, selectedOption);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <HStack spacing={1} flexWrap="wrap" align="center">
      <Tooltip label={value} fontSize="xs" openDelay={400}>
        <Text
          fontSize="xs"
          fontFamily="mono"
          color="#B8860B"
          fontWeight="700"
          maxW="200px"
          isTruncated
        >
          {converted}
        </Text>
      </Tooltip>

      {/* Custom unit dropdown */}
      <Box position="relative" ref={dropdownRef}>
        <Button
          size="xs"
          h="18px"
          px={1.5}
          fontSize="9px"
          fontWeight="700"
          textTransform="uppercase"
          bg="transparent"
          color="text.secondary"
          border="1px solid"
          borderColor={dropdownOpen ? "bauhaus.black" : "gray.300"}
          borderRadius={0}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          _hover={{ borderColor: "bauhaus.black" }}
          _active={{ transform: "translate(1px, 1px)" }}
          rightIcon={<ChevronDownIcon boxSize={3} />}
        >
          {selectedOption}
        </Button>

        {dropdownOpen && (
          <VStack
            position="absolute"
            top="100%"
            left={0}
            mt="2px"
            bg="bauhaus.white"
            border="1.5px solid"
            borderColor="bauhaus.black"
            boxShadow="2px 2px 0px 0px #121212"
            zIndex={10}
            spacing={0}
            align="stretch"
            minW="90px"
          >
            {ethFormatOptions.map((opt) => (
              <Box
                key={opt}
                px={2}
                py={1}
                fontSize="9px"
                fontWeight="700"
                textTransform="uppercase"
                cursor="pointer"
                bg={opt === selectedOption ? "bauhaus.black" : "transparent"}
                color={opt === selectedOption ? "bauhaus.white" : "text.primary"}
                _hover={{ bg: opt === selectedOption ? "bauhaus.black" : "bg.muted" }}
                onClick={() => {
                  setSelectedOption(opt);
                  setDropdownOpen(false);
                }}
              >
                {opt}
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <CopyButton value={value} />
    </HStack>
  );
}
