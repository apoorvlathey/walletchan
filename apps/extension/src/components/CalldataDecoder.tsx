import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Skeleton,
  Spacer,
  IconButton,
  Code,
} from "@chakra-ui/react";
import { CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { decodeRecursive } from "@/lib/decoder";
import type { Arg, DecodeBytesParamResult, DecodeParamTypesResult } from "@/lib/decoder/types";

interface DecodedParam {
  name: string;
  type: string;
  value: any;
  children?: DecodedParam[];
}

interface DecodedCalldata {
  functionName: string;
  signature: string;
  params: DecodedParam[];
}

interface CalldataDecoderProps {
  calldata: string;
  to: string;
  chainId: number;
}

// Copy button
function CopyButton({ value }: { value: string }) {
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

function truncateHex(hex: string, maxLen = 10): string {
  if (hex.length <= maxLen + 4) return hex;
  return `${hex.slice(0, maxLen + 2)}...${hex.slice(-4)}`;
}

function ParamValue({ param, chainId }: { param: DecodedParam; chainId: number }) {
  const [labels, setLabels] = useState<string[]>([]);

  // Fetch labels for address params
  useEffect(() => {
    if (param.type !== "address" || !param.value) return;
    fetch(`https://eth.sh/api/labels/${param.value}?chainId=${chainId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => {
        if (Array.isArray(l) && l.length > 0) setLabels(l);
      })
      .catch(() => {});
  }, [param.value, param.type, chainId]);

  if (param.type === "address") {
    return (
      <HStack spacing={1} flexWrap="wrap">
        <Code
          fontSize="xs"
          fontFamily="mono"
          bg="transparent"
          color="bauhaus.blue"
          fontWeight="600"
          p={0}
        >
          {truncateHex(param.value)}
        </Code>
        {labels.length > 0 && (
          <Text fontSize="10px" color="text.secondary" fontWeight="700">
            ({labels[0]})
          </Text>
        )}
      </HStack>
    );
  }

  if (param.type.startsWith("uint") || param.type.startsWith("int")) {
    const strVal = String(param.value);
    return (
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="#B8860B" fontWeight="600" p={0}>
        {strVal.length > 20 ? `${strVal.slice(0, 20)}...` : strVal}
      </Code>
    );
  }

  if (param.type === "bytes" || param.type.startsWith("bytes")) {
    const hex = typeof param.value === "string" ? param.value : "0x";
    return (
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="text.tertiary" fontWeight="600" p={0}>
        {truncateHex(hex, 16)}
      </Code>
    );
  }

  if (param.type === "bool") {
    return (
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color={param.value ? "bauhaus.green" : "bauhaus.red"} fontWeight="600" p={0}>
        {String(param.value)}
      </Code>
    );
  }

  if (param.type === "string") {
    const str = String(param.value);
    return (
      <Code fontSize="xs" fontFamily="mono" bg="transparent" color="text.primary" fontWeight="600" p={0}>
        &quot;{str.length > 40 ? `${str.slice(0, 40)}...` : str}&quot;
      </Code>
    );
  }

  // Tuple or array with children
  if (param.children && param.children.length > 0) {
    return (
      <VStack align="start" spacing={1} pl={2} borderLeft="2px solid" borderColor="gray.200">
        {param.children.map((child, i) => (
          <HStack key={i} spacing={1} align="start" flexWrap="wrap">
            <Text fontSize="10px" color="text.tertiary" fontFamily="mono" fontWeight="600" minW="fit-content">
              {child.name || `[${i}]`}:
            </Text>
            <ParamValue param={child} chainId={chainId} />
          </HStack>
        ))}
      </VStack>
    );
  }

  // Fallback
  const fallback = typeof param.value === "object" ? JSON.stringify(param.value) : String(param.value);
  return (
    <Code fontSize="xs" fontFamily="mono" bg="transparent" color="text.tertiary" fontWeight="600" p={0} wordBreak="break-all">
      {fallback.length > 60 ? `${fallback.slice(0, 60)}...` : fallback}
    </Code>
  );
}

function CalldataDecoder({ calldata, to, chainId }: CalldataDecoderProps) {
  const [decoded, setDecoded] = useState<DecodedCalldata | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"decoded" | "raw">("decoded");

  useEffect(() => {
    if (!calldata || calldata === "0x") {
      setLoading(false);
      return;
    }

    const decode = async () => {
      setLoading(true);
      try {
        const result = await decodeRecursive({
          calldata,
          address: to,
          chainId,
        });

        if (result && result.functionName) {
          setDecoded({
            functionName: result.functionName,
            signature: result.signature || "",
            params: transformArgs(result.args),
          });
        } else {
          setDecoded(null);
          setTab("raw");
        }
      } catch {
        setDecoded(null);
        setTab("raw");
      } finally {
        setLoading(false);
      }
    };

    decode();
  }, [calldata, to, chainId]);

  const scrollStyles = {
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-track": { background: "#E0E0E0" },
    "&::-webkit-scrollbar-thumb": { background: "#121212" },
  };

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
          bg={tab === "decoded" ? "bauhaus.black" : "transparent"}
          onClick={() => decoded && setTab("decoded")}
          opacity={decoded ? 1 : 0.5}
        >
          <Text
            fontSize="xs"
            fontWeight="800"
            textTransform="uppercase"
            letterSpacing="wide"
            textAlign="center"
            color={tab === "decoded" ? "bauhaus.white" : "text.secondary"}
          >
            Decoded
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
          <CopyButton value={calldata} />
        </Box>
      </HStack>

      {/* Content */}
      <Box p={3}>
        {loading ? (
          <VStack spacing={2} align="start">
            <Skeleton h="16px" w="120px" />
            <Skeleton h="14px" w="200px" />
            <Skeleton h="14px" w="180px" />
          </VStack>
        ) : tab === "decoded" && decoded ? (
          <VStack align="start" spacing={2}>
            {/* Function name */}
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
              {decoded.functionName}
            </Code>

            {/* Parameters */}
            <Box
              w="full"
              maxH="150px"
              overflowY="auto"
              css={scrollStyles}
            >
              <VStack align="start" spacing={1.5} w="full">
                {decoded.params.map((param, i) => (
                  <HStack key={i} spacing={1} align="start" w="full" flexWrap="wrap">
                    <Text fontSize="10px" color="text.secondary" fontFamily="mono" fontWeight="700" minW="fit-content">
                      {param.name || `arg${i}`}
                    </Text>
                    <Text fontSize="10px" color="text.tertiary" fontFamily="mono">
                      ({param.type})
                    </Text>
                    <ParamValue param={param} chainId={chainId} />
                  </HStack>
                ))}
              </VStack>
            </Box>
          </VStack>
        ) : (
          /* Raw tab */
          <Box
            p={3}
            bg="bg.muted"
            border="2px solid"
            borderColor="bauhaus.black"
            maxH="100px"
            overflowY="auto"
            css={scrollStyles}
          >
            <Text
              fontSize="xs"
              fontFamily="mono"
              color="text.tertiary"
              wordBreak="break-all"
              whiteSpace="pre-wrap"
            >
              {calldata}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Transform decoder Arg[] to our DecodedParam[] format
function transformArgs(args: Arg[]): DecodedParam[] {
  if (!Array.isArray(args)) return [];

  return args.map((arg) => {
    return transformValue(arg.name, arg.type, arg.baseType, arg.value);
  });
}

function transformValue(
  name: string,
  type: string,
  baseType: string,
  value: DecodeParamTypesResult
): DecodedParam {
  // String value (primitives like int, address, bool, string)
  if (typeof value === "string") {
    return { name, type, value };
  }

  // Bytes with decoded nested calldata
  if (value && typeof value === "object" && "decoded" in value) {
    const bytesVal = value as DecodeBytesParamResult;
    if (bytesVal.decoded && bytesVal.decoded.functionName) {
      return {
        name,
        type,
        value: bytesVal.decoded.functionName,
        children: [
          {
            name: "call",
            type: "function",
            value: bytesVal.decoded.functionName,
            children: transformArgs(bytesVal.decoded.args),
          },
        ],
      };
    }
    // Bytes that couldn't be decoded further — show raw hex
    return { name, type, value: String(value) };
  }

  // Tuple or Array (array of Arg-like objects)
  if (Array.isArray(value)) {
    return {
      name,
      type,
      value: "",
      children: value.map((item, i) => {
        return transformValue(
          item.name || `[${i}]`,
          item.type,
          item.baseType,
          item.value
        );
      }),
    };
  }

  // Null
  if (value === null || value === undefined) {
    return { name, type, value: "" };
  }

  // Fallback
  return { name, type, value: String(value) };
}

export default memo(CalldataDecoder);
