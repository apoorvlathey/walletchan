import { useState, useEffect } from "react";
import {
  Button,
  Center,
  Box,
  Input,
  Heading,
  Stack,
  Flex,
  Spacer,
  HStack,
  Text,
} from "@chakra-ui/react";
import { ChevronLeftIcon } from "@chakra-ui/icons";
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
    <>
      <Flex>
        <Spacer />
        <Button size="sm" variant="ghost" onClick={() => back()}>
          <HStack>
            <ChevronLeftIcon fontSize="2xl" /> <Text>Back</Text>
          </HStack>
        </Button>
      </Flex>
      <Box>
        <Heading size="md">Edit Chain</Heading>
        <Stack mt="1rem" spacing={2}>
          <Input
            placeholder="Name"
            aria-label="Name"
            autoComplete="off"
            minW="20rem"
            size="sm"
            rounded="lg"
            value={newChainName}
            onChange={(e) => {
              setNewChainName(e.target.value);
              if (isChainNameNotUnique) {
                setIsChainNameNotUnique(false); // remove invalid warning when user types again
              }
            }}
            isInvalid={isChainNameNotUnique}
          />
          <Input
            placeholder="RPC Url"
            aria-label="RPC Url"
            autoComplete="off"
            minW="20rem"
            size="sm"
            rounded="lg"
            value={rpc}
            onChange={(e) => {
              setRpc(e.target.value);
            }}
          />
          <Input
            placeholder="Chain Id"
            aria-label="Chain Id"
            type="number"
            autoComplete="off"
            minW="20rem"
            size="sm"
            rounded="lg"
            value={chainId}
            isReadOnly
            bg="gray.700"
            cursor="not-allowed"
          />
          <Center>
            <Button
              size="sm"
              maxW="6rem"
              colorScheme="blue"
              onClick={() => saveChain()}
              isLoading={isBtnLoading}
            >
              Save
            </Button>
          </Center>
        </Stack>
      </Box>
    </>
  );
}

export default EditChain;
