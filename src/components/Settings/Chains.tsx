import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Spacer,
  VStack,
  Text,
  IconButton,
  Heading,
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { useNetworks } from "@/contexts/NetworksContext";
import { NetworksInfo } from "@/types";
import { getChainConfig } from "@/constants/chainConfig";
import AddChain from "./AddChain";
import EditChain from "./EditChain";

function Chain({
  chainName,
  network,
  openEditChain,
}: {
  chainName: string;
  network: NetworksInfo[string];
  openEditChain: () => void;
}) {
  const config = getChainConfig(network.chainId);

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      p={3}
      cursor="pointer"
      onClick={openEditChain}
      _hover={{
        bg: "bg.emphasis",
        borderColor: "border.strong",
      }}
      transition="all 0.2s"
    >
      <HStack justify="space-between">
        <HStack spacing={3}>
          {config.icon && (
            <Image src={config.icon} alt={chainName} boxSize="24px" />
          )}
          <Box>
            <Text fontWeight="500" color="text.primary">
              {chainName}
            </Text>
            <Text fontSize="xs" color="text.tertiary" noOfLines={1}>
              {network.rpcUrl}
            </Text>
          </Box>
        </HStack>
        <HStack spacing={2}>
          <Text fontSize="xs" color="text.secondary">
            ID: {network.chainId}
          </Text>
          <ChevronRightIcon color="text.tertiary" />
        </HStack>
      </HStack>
    </Box>
  );
}

function Chains({ close }: { close: () => void }) {
  const { networksInfo } = useNetworks();

  const [tab, setTab] = useState<React.ReactElement>();

  if (tab !== undefined) {
    return tab;
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Header */}
      <HStack>
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          size="sm"
          onClick={close}
        />
        <Heading size="sm" color="text.primary">
          Chain RPCs
        </Heading>
        <Spacer />
      </HStack>

      <Text fontSize="sm" color="text.secondary">
        Configure RPC endpoints for supported networks.
      </Text>

      {/* Chain List */}
      <VStack spacing={2} align="stretch">
        {networksInfo &&
          Object.keys(networksInfo).map((chainName, i) => (
            <Chain
              key={i}
              chainName={chainName}
              network={networksInfo[chainName]}
              openEditChain={() =>
                setTab(
                  <EditChain
                    back={() => setTab(undefined)}
                    chainName={chainName}
                  />
                )
              }
            />
          ))}
      </VStack>

      <Button
        variant="primary"
        onClick={() => setTab(<AddChain back={() => setTab(undefined)} />)}
      >
        Add Chain
      </Button>
    </VStack>
  );
}

export default Chains;
