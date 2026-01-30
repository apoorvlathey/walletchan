import { useState, useEffect } from "react";
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

function EditChain({
  chainName,
  back,
}: {
  chainName: string;
  back: () => void;
}) {
  const { networksInfo, setNetworksInfo } = useNetworks();

  const [newChainName, setNewChainName] = useState<string>(chainName);
  const [chainId, setChainId] = useState<string>();
  const [rpc, setRpc] = useState<string>();
  const [isBtnLoading, setIsBtnLoading] = useState(false);
  const [isChainNameNotUnique, setIsChainNameNotUnique] = useState(false);

  const saveChain = () => {
    setIsBtnLoading(true);

    if (newChainName && chainId && rpc && networksInfo) {
      if (newChainName !== chainName && networksInfo[newChainName]) {
        setIsChainNameNotUnique(true);
      } else {
        setNetworksInfo((_networksInfo) => {
          if (newChainName !== chainName && _networksInfo) {
            delete _networksInfo[chainName];
          }

          back();
          return {
            ..._networksInfo,
            [newChainName]: {
              chainId: parseInt(chainId),
              rpcUrl: rpc,
            },
          };
        });
      }
    }

    setIsBtnLoading(false);
  };

  useEffect(() => {
    if (networksInfo) {
      setChainId(networksInfo[chainName].chainId.toString());
      setRpc(networksInfo[chainName].rpcUrl);
    }
  }, [networksInfo, chainName]);

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
        <Heading size="sm" color="text.primary">
          Edit Chain
        </Heading>
        <Spacer />
      </HStack>

      <FormControl>
        <FormLabel color="text.secondary">Name</FormLabel>
        <Input
          placeholder="Chain name"
          value={newChainName}
          onChange={(e) => {
            setNewChainName(e.target.value);
            if (isChainNameNotUnique) {
              setIsChainNameNotUnique(false);
            }
          }}
          isInvalid={isChainNameNotUnique}
          bg="bg.subtle"
          borderColor="border.default"
          _hover={{ borderColor: "border.strong" }}
          _focus={{
            borderColor: "primary.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
          }}
        />
        {isChainNameNotUnique && (
          <Text fontSize="xs" color="error.solid" mt={1}>
            Chain name already exists
          </Text>
        )}
      </FormControl>

      <FormControl>
        <FormLabel color="text.secondary">RPC URL</FormLabel>
        <Input
          placeholder="https://..."
          value={rpc}
          onChange={(e) => setRpc(e.target.value)}
          bg="bg.subtle"
          borderColor="border.default"
          _hover={{ borderColor: "border.strong" }}
          _focus={{
            borderColor: "primary.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary-500)",
          }}
        />
      </FormControl>

      <FormControl>
        <FormLabel color="text.secondary">Chain ID</FormLabel>
        <Input
          placeholder="Chain ID"
          value={chainId}
          isReadOnly
          bg="bg.muted"
          borderColor="border.default"
          color="text.tertiary"
          cursor="not-allowed"
        />
        <Text fontSize="xs" color="text.tertiary" mt={1}>
          Chain ID cannot be changed
        </Text>
      </FormControl>

      <Box display="flex" gap={2} pt={2}>
        <Button variant="outline" flex={1} onClick={back}>
          Cancel
        </Button>
        <Button
          variant="primary"
          flex={1}
          onClick={saveChain}
          isLoading={isBtnLoading}
        >
          Save
        </Button>
      </Box>
    </VStack>
  );
}

export default EditChain;
