import { useState } from "react";
import {
  Button,
  Box,
  Input,
  Heading,
  VStack,
  HStack,
  Text,
  IconButton,
  Spacer,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { useNetworks } from "@/contexts/NetworksContext";
import { StaticJsonRpcProvider } from "@ethersproject/providers";

function AddChain({ back }: { back: () => void }) {
  const { networksInfo, setNetworksInfo, setReloadRequired } = useNetworks();

  const [chainName, setChainName] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [rpc, setRpc] = useState<string>("");
  const [isBtnLoading, setIsBtnLoading] = useState(false);
  const [isChainNameNotUnique, setIsChainNameNotUnique] = useState(false);

  const addChain = () => {
    setIsBtnLoading(true);

    if (chainName && chainId && rpc) {
      if (networksInfo && networksInfo[chainName]) {
        setIsChainNameNotUnique(true);
      } else {
        setNetworksInfo((_networksInfo) => {
          back();

          if (!_networksInfo || Object.keys(_networksInfo).length === 0) {
            setReloadRequired(true);
          }

          return {
            ..._networksInfo,
            [chainName]: {
              chainId: parseInt(chainId),
              rpcUrl: rpc,
            },
          };
        });
      }
    }

    setIsBtnLoading(false);
  };

  const handleRpcPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    setIsBtnLoading(true);
    try {
      const _rpc = e.clipboardData.getData("Text").trim();
      const provider = new StaticJsonRpcProvider(_rpc);
      const _chainId = (await provider.getNetwork()).chainId;
      setChainId(_chainId.toString());
    } catch (err) {
      // Ignore errors - user can manually enter chain ID
    }
    setIsBtnLoading(false);
  };

  return (
    <VStack spacing={4} align="stretch">
      {/* Header */}
      <HStack>
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          size="sm"
          onClick={back}
        />
        <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="tight">
          Add Chain
        </Text>
        <Spacer />
      </HStack>

      <Text fontSize="sm" color="text.secondary" fontWeight="500">
        Add a new network by entering its RPC URL and chain ID.
      </Text>

      <FormControl>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          Name
        </FormLabel>
        <Input
          placeholder="e.g., Arbitrum"
          value={chainName}
          onChange={(e) => {
            setChainName(e.target.value);
            if (isChainNameNotUnique) {
              setIsChainNameNotUnique(false);
            }
          }}
          isInvalid={isChainNameNotUnique}
        />
        {isChainNameNotUnique && (
          <Text fontSize="xs" color="bauhaus.red" mt={1} fontWeight="700">
            Chain name already exists
          </Text>
        )}
      </FormControl>

      <FormControl>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          RPC URL
        </FormLabel>
        <Input
          placeholder="https://..."
          value={rpc}
          onChange={(e) => setRpc(e.target.value.trim())}
          onPaste={handleRpcPaste}
        />
        <Text fontSize="xs" color="text.tertiary" mt={1} fontWeight="500">
          Paste RPC URL to auto-detect chain ID
        </Text>
      </FormControl>

      <FormControl>
        <FormLabel color="text.secondary" fontWeight="700" textTransform="uppercase" fontSize="xs">
          Chain ID
        </FormLabel>
        <Input
          placeholder="e.g., 42161"
          type="number"
          value={chainId}
          onChange={(e) => setChainId(e.target.value)}
        />
      </FormControl>

      <Box display="flex" gap={2} pt={2}>
        <Button variant="secondary" flex={1} onClick={back}>
          Cancel
        </Button>
        <Button
          variant="primary"
          flex={1}
          onClick={addChain}
          isLoading={isBtnLoading}
          isDisabled={!chainName || !chainId || !rpc}
        >
          Add Chain
        </Button>
      </Box>
    </VStack>
  );
}

export default AddChain;
