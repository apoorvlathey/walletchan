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
  Badge,
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
      bg="bauhaus.white"
      border="3px solid"
      borderColor="bauhaus.black"
      boxShadow="4px 4px 0px 0px #121212"
      p={3}
      cursor="pointer"
      onClick={openEditChain}
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "6px 6px 0px 0px #121212",
      }}
      _active={{
        transform: "translate(2px, 2px)",
        boxShadow: "none",
      }}
      transition="all 0.2s ease-out"
      position="relative"
    >
      {/* Corner decoration */}
      <Box
        position="absolute"
        top="-3px"
        right="-3px"
        w="8px"
        h="8px"
        bg={config.bg || "bauhaus.blue"}
        border="2px solid"
        borderColor="bauhaus.black"
      />

      <HStack justify="space-between">
        <HStack spacing={3}>
          {config.icon && (
            <Box
              bg="bauhaus.white"
              border="2px solid"
              borderColor="bauhaus.black"
              p={1}
            >
              <Image src={config.icon} alt={chainName} boxSize="20px" />
            </Box>
          )}
          <Box>
            <Text fontWeight="700" color="text.primary">
              {chainName}
            </Text>
            <Text fontSize="xs" color="text.tertiary" noOfLines={1} fontWeight="500">
              {network.rpcUrl}
            </Text>
          </Box>
        </HStack>
        <HStack spacing={2}>
          <Badge
            fontSize="xs"
            bg="bauhaus.black"
            color="bauhaus.white"
            border="2px solid"
            borderColor="bauhaus.black"
            fontWeight="700"
          >
            ID: {network.chainId}
          </Badge>
          <Box bg="bauhaus.black" p={1}>
            <ChevronRightIcon color="bauhaus.white" />
          </Box>
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
        <Text fontSize="lg" fontWeight="900" color="text.primary" textTransform="uppercase" letterSpacing="tight">
          Chain RPCs
        </Text>
        <Spacer />
      </HStack>

      <Text fontSize="sm" color="text.secondary" fontWeight="500">
        Configure RPC endpoints for supported networks.
      </Text>

      {/* Chain List */}
      <VStack spacing={3} align="stretch">
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
