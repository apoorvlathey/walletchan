"use client";

import { useCallback } from "react";
import { Box, HStack, VStack, Text, IconButton, Select } from "@chakra-ui/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ImpersonatorIframeProvider,
  ImpersonatorIframe,
} from "@impersonator/iframe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { CHAIN_RPC_URLS } from "@/app/wagmiConfig";
import { CHAIN_NAMES } from "../data/dapps";

interface IframeAppProps {
  appUrl: string;
  appName: string;
  supportedChains: number[];
  onBack: () => void;
}

export function IframeApp({
  appUrl,
  appName,
  supportedChains,
  onBack,
}: IframeAppProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const rpcUrl = CHAIN_RPC_URLS[chainId] ?? `https://eth.llamarpc.com`;

  const handleTransaction = useCallback(
    async (tx: any): Promise<string> => {
      if (!walletClient) throw new Error("No wallet client");
      return walletClient.sendTransaction(tx);
    },
    [walletClient]
  );

  const handleSignMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!walletClient) throw new Error("No wallet client");
      return walletClient.signMessage({ message });
    },
    [walletClient]
  );

  const handleSignTypedData = useCallback(
    async (typedData: any): Promise<string> => {
      if (!walletClient) throw new Error("No wallet client");
      return walletClient.signTypedData(typedData);
    },
    [walletClient]
  );

  const availableChains = supportedChains.filter(
    (id) => CHAIN_RPC_URLS[id] !== undefined
  );

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Toolbar */}
      <Box
        bg="bauhaus.black"
        borderBottom="4px solid"
        borderColor="bauhaus.black"
        px={4}
        py={2}
      >
        <HStack justify="space-between">
          <HStack spacing={3}>
            <IconButton
              aria-label="Back to apps"
              icon={<ArrowLeft size={16} />}
              size="sm"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={onBack}
            />
            <Text
              color="white"
              fontWeight="900"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              {appName}
            </Text>
          </HStack>

          <HStack spacing={3}>
            <Select
              size="sm"
              bg="whiteAlpha.200"
              color="white"
              border="2px solid"
              borderColor="whiteAlpha.300"
              borderRadius="0"
              fontWeight="700"
              fontSize="xs"
              w="140px"
              value={chainId}
              onChange={(e) =>
                switchChain({ chainId: Number(e.target.value) })
              }
            >
              {availableChains.map((id) => (
                <option key={id} value={id} style={{ color: "black" }}>
                  {CHAIN_NAMES[id] || `Chain ${id}`}
                </option>
              ))}
            </Select>

            <IconButton
              aria-label="Open in new tab"
              icon={<ExternalLink size={16} />}
              size="sm"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              as="a"
              href={appUrl}
              target="_blank"
            />
          </HStack>
        </HStack>

        {/* Connection status */}
        {address && (
          <HStack mt={1} spacing={2}>
            <Box w="6px" h="6px" bg="green.400" borderRadius="full" />
            <Text color="whiteAlpha.700" fontSize="xs" fontFamily="mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
          </HStack>
        )}
      </Box>

      {/* Not connected state */}
      {!isConnected && (
        <VStack flex={1} justify="center" spacing={6} p={8}>
          <Text
            fontWeight="900"
            fontSize="lg"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            Connect Wallet
          </Text>
          <Text color="gray.600" fontWeight="500" textAlign="center">
            Connect your wallet to interact with {appName}
          </Text>
          <ConnectButton />
        </VStack>
      )}

      {/* Iframe */}
      {isConnected && address && (
        <Box flex={1} position="relative">
          <ImpersonatorIframeProvider
            address={address}
            rpcUrl={rpcUrl}
            sendTransaction={handleTransaction}
            signMessage={handleSignMessage}
            signTypedData={handleSignTypedData}
          >
            <ImpersonatorIframe
              src={appUrl}
              address={address}
              rpcUrl={rpcUrl}
              width="100%"
              height="100%"
            />
          </ImpersonatorIframeProvider>
        </Box>
      )}
    </Box>
  );
}
