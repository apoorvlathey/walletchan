import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Code,
  IconButton,
  Spacer,
} from "@chakra-ui/react";
import { CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";

interface TypedDataDisplayProps {
  typedData: any;
  rawData: string;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useBauhausToast();

  return (
    <IconButton
      aria-label="Copy"
      icon={copied ? <CheckIcon /> : <CopyIcon />}
      size="xs"
      variant="ghost"
      color={copied ? "bauhaus.yellow" : "text.secondary"}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast({ title: "Copied!", status: "success", duration: 1500 });
        setTimeout(() => setCopied(false), 2000);
      }}
      _hover={{ color: "bauhaus.blue", bg: "bg.muted" }}
    />
  );
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function AddressValue({ address, chainId }: { address: string; chainId?: number }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !address.startsWith("0x")) return;
    const cid = chainId || 1;
    fetch(`https://eth.sh/api/labels/${address}?chainId=${cid}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => {
        if (Array.isArray(l) && l.length > 0) setLabel(l[0]);
      })
      .catch(() => {});
  }, [address, chainId]);

  return (
    <HStack spacing={1}>
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="bauhaus.blue" fontWeight="600" p={0}>
        {truncateAddr(address)}
      </Code>
      {label && (
        <Text fontSize="10px" color="text.secondary" fontWeight="700">
          ({label})
        </Text>
      )}
    </HStack>
  );
}

function MessageField({ name, value, depth = 0, chainId }: { name: string; value: any; depth?: number; chainId?: number }) {
  if (value === null || value === undefined) return null;

  // Address
  if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
    return (
      <HStack spacing={1} align="start" flexWrap="wrap" pl={depth * 3}>
        <Text fontSize="xs" color="text.secondary" fontWeight="700" minW="fit-content">
          {name}:
        </Text>
        <AddressValue address={value} chainId={chainId} />
      </HStack>
    );
  }

  // Number or bigint string
  if (typeof value === "number" || typeof value === "bigint" || (typeof value === "string" && /^\d+$/.test(value))) {
    return (
      <HStack spacing={1} align="start" flexWrap="wrap" pl={depth * 3}>
        <Text fontSize="xs" color="text.secondary" fontWeight="700" minW="fit-content">
          {name}:
        </Text>
        <Code fontSize="xs" fontFamily="mono" bg="transparent" color="#B8860B" fontWeight="600" p={0}>
          {String(value)}
        </Code>
      </HStack>
    );
  }

  // Boolean
  if (typeof value === "boolean") {
    return (
      <HStack spacing={1} align="start" flexWrap="wrap" pl={depth * 3}>
        <Text fontSize="xs" color="text.secondary" fontWeight="700" minW="fit-content">
          {name}:
        </Text>
        <Code fontSize="xs" fontFamily="mono" bg="transparent" color={value ? "bauhaus.green" : "bauhaus.red"} fontWeight="600" p={0}>
          {String(value)}
        </Code>
      </HStack>
    );
  }

  // Nested object
  if (typeof value === "object" && !Array.isArray(value)) {
    return (
      <VStack align="start" spacing={1} pl={depth * 3}>
        <Text fontSize="xs" color="text.secondary" fontWeight="700">
          {name}:
        </Text>
        <VStack align="start" spacing={1} pl={3} borderLeft="2px solid" borderColor="gray.200">
          {Object.entries(value).map(([k, v]) => (
            <MessageField key={k} name={k} value={v} depth={0} chainId={chainId} />
          ))}
        </VStack>
      </VStack>
    );
  }

  // Array
  if (Array.isArray(value)) {
    return (
      <VStack align="start" spacing={1} pl={depth * 3}>
        <Text fontSize="xs" color="text.secondary" fontWeight="700">
          {name}: [{value.length}]
        </Text>
        <VStack align="start" spacing={1} pl={3} borderLeft="2px solid" borderColor="gray.200">
          {value.map((item, i) => (
            <MessageField key={i} name={`[${i}]`} value={item} depth={0} chainId={chainId} />
          ))}
        </VStack>
      </VStack>
    );
  }

  // String or other
  return (
    <HStack spacing={1} align="start" flexWrap="wrap" pl={depth * 3}>
      <Text fontSize="xs" color="text.secondary" fontWeight="700" minW="fit-content">
        {name}:
      </Text>
      <Text fontSize="xs" fontFamily="mono" color="text.primary" fontWeight="600" wordBreak="break-all">
        {String(value)}
      </Text>
    </HStack>
  );
}

const scrollStyles = {
  "&::-webkit-scrollbar": { width: "6px" },
  "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
  "&::-webkit-scrollbar-thumb": { background: "#121212" },
};

function TypedDataDisplay({ typedData, rawData }: TypedDataDisplayProps) {
  const [tab, setTab] = useState<"structured" | "raw">("structured");
  const domain = typedData?.domain;
  const message = typedData?.message;
  const primaryType = typedData?.primaryType;
  const chainId = domain?.chainId ? Number(domain.chainId) : undefined;

  return (
    <Box
      bg="bauhaus.white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
    >
      {/* Tab header */}
      <HStack p={0} borderBottom="2px solid" borderColor="bauhaus.black" spacing={0}>
        <Box
          flex={1}
          py={2}
          px={3}
          cursor="pointer"
          bg={tab === "structured" ? "bauhaus.black" : "transparent"}
          onClick={() => setTab("structured")}
        >
          <Text
            fontSize="xs"
            fontWeight="800"
            textTransform="uppercase"
            letterSpacing="wide"
            textAlign="center"
            color={tab === "structured" ? "bauhaus.white" : "text.secondary"}
          >
            Structured
          </Text>
        </Box>
        <Box w="2px" bg="bauhaus.black" alignSelf="stretch" />
        <Box
          flex={1}
          py={2}
          px={3}
          cursor="pointer"
          bg={tab === "raw" ? "bauhaus.black" : "transparent"}
          onClick={() => setTab("raw")}
        >
          <Text
            fontSize="xs"
            fontWeight="800"
            textTransform="uppercase"
            letterSpacing="wide"
            textAlign="center"
            color={tab === "raw" ? "bauhaus.white" : "text.secondary"}
          >
            Raw
          </Text>
        </Box>
        <Spacer />
        <Box pr={1}>
          <CopyBtn value={rawData} />
        </Box>
      </HStack>

      {/* Content */}
      <Box p={3} maxH="250px" overflowY="auto" css={scrollStyles}>
        {tab === "structured" ? (
          <VStack align="start" spacing={3}>
            {/* Domain section */}
            {domain && (
              <VStack align="start" spacing={1} w="full">
                <Code
                  px={2}
                  py={0.5}
                  fontSize="10px"
                  bg="bauhaus.red"
                  color="white"
                  fontWeight="800"
                  border="1px solid"
                  borderColor="bauhaus.black"
                  textTransform="uppercase"
                >
                  Domain
                </Code>
                <VStack align="start" spacing={0.5} pl={1}>
                  {domain.name && (
                    <HStack spacing={1}>
                      <Text fontSize="xs" color="text.secondary" fontWeight="700">name:</Text>
                      <Text fontSize="xs" color="text.primary" fontWeight="600">{domain.name}</Text>
                    </HStack>
                  )}
                  {domain.version && (
                    <HStack spacing={1}>
                      <Text fontSize="xs" color="text.secondary" fontWeight="700">version:</Text>
                      <Text fontSize="xs" color="text.tertiary" fontWeight="600">{domain.version}</Text>
                    </HStack>
                  )}
                  {domain.chainId && (
                    <HStack spacing={1}>
                      <Text fontSize="xs" color="text.secondary" fontWeight="700">chainId:</Text>
                      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="#B8860B" fontWeight="600" p={0}>
                        {String(domain.chainId)}
                      </Code>
                    </HStack>
                  )}
                  {domain.verifyingContract && (
                    <HStack spacing={1} flexWrap="wrap">
                      <Text fontSize="xs" color="text.secondary" fontWeight="700">contract:</Text>
                      <AddressValue address={domain.verifyingContract} chainId={chainId} />
                    </HStack>
                  )}
                </VStack>
              </VStack>
            )}

            {/* Primary Type */}
            {primaryType && (
              <Code
                px={2}
                py={1}
                fontSize="xs"
                bg="bauhaus.blue"
                color="white"
                fontFamily="mono"
                border="2px solid"
                borderColor="bauhaus.black"
                fontWeight="700"
              >
                {primaryType}
              </Code>
            )}

            {/* Message fields */}
            {message && (
              <VStack align="start" spacing={1.5} w="full">
                {Object.entries(message).map(([key, val]) => (
                  <MessageField key={key} name={key} value={val} chainId={chainId} />
                ))}
              </VStack>
            )}
          </VStack>
        ) : (
          /* Raw tab */
          <Box
            p={3}
            bg="bg.muted"
            border="2px solid"
            borderColor="bauhaus.black"
            maxH="200px"
            overflowY="auto"
            css={scrollStyles}
          >
            <Text fontSize="xs" fontFamily="mono" color="text.tertiary" wordBreak="break-all" whiteSpace="pre-wrap">
              {rawData}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default memo(TypedDataDisplay);
