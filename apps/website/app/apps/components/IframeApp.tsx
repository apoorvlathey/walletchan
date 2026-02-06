"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Box,
  HStack,
  Text,
  IconButton,
  Select,
  Spinner,
} from "@chakra-ui/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ImpersonatorIframeProvider,
  ImpersonatorIframe,
} from "@impersonator/iframe";

const SUPPORTED_CHAINS: { id: number; name: string; rpc: string }[] = [
  { id: 1, name: "Ethereum", rpc: "https://eth.llamarpc.com" },
  { id: 8453, name: "Base", rpc: "https://base.llamarpc.com" },
  { id: 137, name: "Polygon", rpc: "https://polygon.llamarpc.com" },
  { id: 130, name: "Unichain", rpc: "https://mainnet.unichain.org" },
];

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
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<number>(
    supportedChains[0] || 1
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === selectedChainId);

  // Try to connect to BankrWallet on mount
  useEffect(() => {
    connectWallet();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check for BankrWallet or any injected provider
      const provider = (window as any).ethereum;
      if (!provider) {
        setError("No wallet detected. Install BankrWallet to use dApps.");
        setIsConnecting(false);
        return;
      }

      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });

      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
      } else {
        setError("No accounts found. Please unlock your wallet.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Forward transaction to BankrWallet
  const handleTransaction = useCallback(
    async (tx: any): Promise<string> => {
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No wallet provider");

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      return hash as string;
    },
    []
  );

  // Forward message signing to BankrWallet
  const handleSignMessage = useCallback(
    async (message: string): Promise<string> => {
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No wallet provider");

      const signature = await provider.request({
        method: "personal_sign",
        params: [message, connectedAddress],
      });
      return signature as string;
    },
    [connectedAddress]
  );

  // Forward typed data signing to BankrWallet
  const handleSignTypedData = useCallback(
    async (typedData: any): Promise<string> => {
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No wallet provider");

      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [connectedAddress, JSON.stringify(typedData)],
      });
      return signature as string;
    },
    [connectedAddress]
  );

  const availableChains = SUPPORTED_CHAINS.filter((c) =>
    supportedChains.includes(c.id)
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
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(Number(e.target.value))}
            >
              {availableChains.map((chain) => (
                <option
                  key={chain.id}
                  value={chain.id}
                  style={{ color: "black" }}
                >
                  {chain.name}
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
        {connectedAddress && (
          <HStack mt={1} spacing={2}>
            <Box w="6px" h="6px" bg="green.400" borderRadius="full" />
            <Text color="whiteAlpha.700" fontSize="xs" fontFamily="mono">
              {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
            </Text>
          </HStack>
        )}
      </Box>

      {/* Error or loading state */}
      {error && (
        <Box bg="bauhaus.red" p={3} borderBottom="3px solid" borderColor="bauhaus.black">
          <Text color="white" fontSize="sm" fontWeight="700">
            {error}
          </Text>
        </Box>
      )}

      {isConnecting && (
        <Box p={8} textAlign="center">
          <Spinner size="lg" color="bauhaus.blue" />
          <Text mt={3} fontWeight="700" textTransform="uppercase">
            Connecting wallet...
          </Text>
        </Box>
      )}

      {/* Iframe */}
      {connectedAddress && selectedChain && (
        <Box flex={1} position="relative">
          <ImpersonatorIframeProvider
            address={connectedAddress as `0x${string}`}
            rpcUrl={selectedChain.rpc}
            sendTransaction={handleTransaction}
            signMessage={handleSignMessage}
            signTypedData={handleSignTypedData}
          >
            <ImpersonatorIframe
              src={appUrl}
              address={connectedAddress as `0x${string}`}
              rpcUrl={selectedChain.rpc}
              width="100%"
              height="100%"
            />
          </ImpersonatorIframeProvider>
        </Box>
      )}
    </Box>
  );
}
