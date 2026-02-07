import { useState, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Skeleton,
  Spacer,
  Code,
} from "@chakra-ui/react";
import { CopyButton } from "@/components/CopyButton";
import { ShapesLoader } from "@/components/Chat/ShapesLoader";
import { decodeRecursive } from "@/lib/decoder";
import { renderParams } from "@/components/renderParams";
import type { DecodeRecursiveResult } from "@/lib/decoder/types";

interface CalldataDecoderProps {
  calldata: string;
  to: string;
  chainId: number;
}

/**
 * Serialize decoded result to a JSON-friendly format for copying.
 */
function serializeResult(result: DecodeRecursiveResult): string {
  if (!result) return "";
  try {
    const serialized = {
      functionName: result.functionName,
      signature: result.signature,
      args: result.args.map((arg) => ({
        name: arg.name,
        type: arg.type,
        value: serializeValue(arg.value),
      })),
    };
    return JSON.stringify(serialized, null, 2);
  } catch {
    return JSON.stringify(result, null, 2);
  }
}

function serializeValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();

  // DecodeBytesParamResult
  if (typeof value === "object" && "decoded" in value) {
    const decoded = value.decoded;
    if (decoded?.functionName) {
      return {
        functionName: decoded.functionName,
        args: decoded.args.map((a: any) => ({
          name: a.name,
          type: a.type,
          value: serializeValue(a.value),
        })),
      };
    }
    return null;
  }

  // Array (tuple or array params)
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object" && "name" in item && "value" in item) {
        return {
          name: item.name,
          type: item.type,
          value: serializeValue(item.value),
        };
      }
      return serializeValue(item);
    });
  }

  return String(value);
}

function CalldataDecoder({ calldata, to, chainId }: CalldataDecoderProps) {
  const [result, setResult] = useState<DecodeRecursiveResult>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"decoded" | "raw">("raw");

  useEffect(() => {
    if (!calldata || calldata === "0x") {
      setLoading(false);
      return;
    }

    const decode = async () => {
      setLoading(true);
      try {
        const decoded = await decodeRecursive({
          calldata,
          address: to,
          chainId,
        });

        if (decoded && decoded.functionName) {
          setResult(decoded);
          setTab("decoded");
        } else {
          setResult(null);
        }
      } catch {
        setResult(null);
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

  // Copy value: full JSON for decoded tab, raw calldata for raw tab
  const copyValue = tab === "decoded" && result
    ? serializeResult(result)
    : calldata;

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
          onClick={() => setTab("decoded")}
        >
          <HStack spacing={1.5} justify="center">
            <Text
              fontSize="xs"
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing="wide"
              color={tab === "decoded" ? "bauhaus.white" : "text.secondary"}
            >
              Decoded
            </Text>
            {loading && <ShapesLoader size="6px" />}
          </HStack>
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
          <CopyButton value={copyValue} />
        </Box>
      </HStack>

      {/* Content */}
      <Box p={3}>
        {tab === "decoded" ? (
          loading ? (
            <VStack spacing={2} align="start">
              <Skeleton h="16px" w="120px" />
              <Skeleton h="14px" w="200px" />
              <Skeleton h="14px" w="180px" />
            </VStack>
          ) : result ? (
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
                {result.functionName}
              </Code>

              {/* Parameters */}
              <Box
                w="full"
                maxH="250px"
                overflowY="auto"
                css={scrollStyles}
              >
                <VStack align="start" spacing={1.5} w="full">
                  {result.args.map((arg, i) => renderParams(i, arg, chainId))}
                </VStack>
              </Box>
            </VStack>
          ) : (
            <Text fontSize="xs" color="text.tertiary" fontWeight="600">
              Could not decode calldata
            </Text>
          )
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

export default memo(CalldataDecoder);
