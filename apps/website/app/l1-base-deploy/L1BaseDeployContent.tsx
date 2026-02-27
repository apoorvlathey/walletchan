"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Spinner,
  Link,
  Flex,
  useToast,
} from "@chakra-ui/react";
import { AlertTriangle, ExternalLink, Rocket, CheckCircle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { isAddress, decodeEventLog } from "viem";
import { base, mainnet } from "wagmi/chains";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import {
  optimismMintableERC20FactoryAbi,
  erc20MetadataAbi,
} from "./abi";

const FACTORY_ADDRESS =
  "0x05cc379EBD9B30BbA19C6fA282AB29218EC61D84" as const;
const TARGET_CHAIN_ID = mainnet.id; // 1

export default function L1BaseDeployContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const toast = useToast();

  const [tokenAddress, setTokenAddress] = useState("");
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const isValidAddress = isAddress(tokenAddress);
  const isWrongChain = isConnected && chainId !== TARGET_CHAIN_ID;

  // Fetch token name from Base
  const { data: tokenName, isLoading: isLoadingName } = useReadContract({
    address: isValidAddress ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20MetadataAbi,
    functionName: "name",
    chainId: base.id,
    query: { enabled: isValidAddress },
  });

  // Fetch token symbol from Base
  const { data: tokenSymbol, isLoading: isLoadingSymbol } = useReadContract({
    address: isValidAddress ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    chainId: base.id,
    query: { enabled: isValidAddress },
  });

  const isLoadingMetadata = isLoadingName || isLoadingSymbol;
  const hasMetadata = !!tokenName && !!tokenSymbol;

  // Deploy transaction
  const {
    writeContract: writeDeploy,
    data: deployTxHash,
    isPending: isDeploying,
    reset: resetDeploy,
  } = useWriteContract();

  // Wait for tx confirmation
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: deployTxHash });

  // Parse logs on confirmation to get deployed token address
  useEffect(() => {
    if (isConfirmed && receipt) {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: optimismMintableERC20FactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "OptimismMintableERC20Created") {
            setDeployedAddress(decoded.args.localToken);
            break;
          }
        } catch {
          // Not our event, skip
        }
      }
    }
  }, [isConfirmed, receipt]);

  // Toast on tx submitted
  useEffect(() => {
    if (deployTxHash) {
      toast({
        title: "Transaction submitted",
        description: (
          <>
            Deploying bridged token on Ethereum.{" "}
            <a
              href={`https://etherscan.io/tx/${deployTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "underline" }}
            >
              View on Etherscan
            </a>
          </>
        ),
        status: "info",
        duration: 10000,
        isClosable: true,
        position: "bottom-right",
      });
    }
  }, [deployTxHash, toast]);

  // Toast on confirmation
  useEffect(() => {
    if (isConfirmed && deployTxHash) {
      toast({
        title: "Token deployed successfully!",
        description: (
          <>
            Your bridged ERC20 is live on Ethereum.{" "}
            <a
              href={`https://etherscan.io/tx/${deployTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "underline" }}
            >
              View on Etherscan
            </a>
          </>
        ),
        status: "success",
        duration: 15000,
        isClosable: true,
        position: "bottom-right",
      });
    }
  }, [isConfirmed, deployTxHash, toast]);

  const handleDeploy = useCallback(() => {
    if (!isValidAddress || !tokenName || !tokenSymbol) return;

    writeDeploy(
      {
        address: FACTORY_ADDRESS,
        abi: optimismMintableERC20FactoryAbi,
        functionName: "createOptimismMintableERC20",
        args: [tokenAddress as `0x${string}`, tokenName, tokenSymbol],
        chainId: TARGET_CHAIN_ID,
      },
      {
        onError: (err) => {
          toast({
            title: "Deploy failed",
            description: err.message.split("\n")[0],
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom-right",
          });
        },
      }
    );
  }, [writeDeploy, tokenAddress, tokenName, tokenSymbol, isValidAddress, toast]);

  const isBusy = isDeploying || isConfirming;

  return (
    <Box minH="100vh" bg="bauhaus.background">
      <Navigation />

      <Container maxW="2xl" px={{ base: 4, md: 6 }} py={{ base: 8, md: 16 }}>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <VStack spacing={2}>
            <Text
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="900"
              textTransform="uppercase"
              letterSpacing="tight"
              textAlign="center"
            >
              Bridge Token to L1
            </Text>
            <Text
              fontSize="sm"
              fontWeight="700"
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="wide"
              textAlign="center"
            >
              Deploy a bridged version of your Base ERC20 on Ethereum Mainnet
            </Text>
          </VStack>

          {/* Connect Wallet */}
          <Flex justify="center">
            <ConnectButton />
          </Flex>

          {/* Wrong Network Banner */}
          {isWrongChain && (
            <HStack
              justify="center"
              spacing={3}
              bg="bauhaus.red"
              border="3px solid"
              borderColor="bauhaus.black"
              px={4}
              py={3}
            >
              <AlertTriangle size={18} color="white" />
              <Text
                fontSize="sm"
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing="wide"
                color="white"
              >
                Wrong Network
              </Text>
              <Button
                size="sm"
                bg="white"
                color="bauhaus.black"
                fontWeight="900"
                textTransform="uppercase"
                letterSpacing="wide"
                borderRadius={0}
                border="2px solid"
                borderColor="bauhaus.black"
                _hover={{ bg: "gray.100" }}
                onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
              >
                Switch to Ethereum
              </Button>
            </HStack>
          )}

          {/* Main Card */}
          <Box
            bg="white"
            border="4px solid"
            borderColor="bauhaus.border"
            boxShadow="8px 8px 0px 0px #121212"
            p={{ base: 5, md: 8 }}
          >
            <VStack spacing={6} align="stretch">
              {/* Token Address Input */}
              <VStack spacing={2} align="stretch">
                <Text
                  fontSize="xs"
                  fontWeight="800"
                  textTransform="uppercase"
                  letterSpacing="widest"
                >
                  ERC20 Token Address on Base
                </Text>
                <Flex
                  border="3px solid"
                  borderColor={
                    tokenAddress && !isValidAddress
                      ? "red.400"
                      : "bauhaus.black"
                  }
                  align="center"
                  px={4}
                  h="56px"
                >
                  <Input
                    value={tokenAddress}
                    onChange={(e) => {
                      setTokenAddress(e.target.value.trim());
                      setDeployedAddress(null);
                      resetDeploy();
                    }}
                    placeholder="0x..."
                    border="none"
                    borderRadius={0}
                    fontWeight="700"
                    fontSize={{ base: "sm", md: "md" }}
                    fontFamily="mono"
                    h="full"
                    p={0}
                    _focus={{ boxShadow: "none" }}
                    _placeholder={{ color: "gray.400" }}
                  />
                  {isLoadingMetadata && isValidAddress && (
                    <Spinner size="sm" color="bauhaus.blue" ml={2} />
                  )}
                </Flex>
                {tokenAddress && !isValidAddress && (
                  <Text fontSize="xs" color="red.500" fontWeight="700">
                    Invalid address
                  </Text>
                )}
              </VStack>

              {/* Token Name & Symbol Display */}
              {isValidAddress && hasMetadata && (
                <HStack spacing={4}>
                  <Box
                    flex={1}
                    bg="bauhaus.background"
                    border="3px solid"
                    borderColor="bauhaus.black"
                    p={4}
                    textAlign="center"
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="800"
                      textTransform="uppercase"
                      letterSpacing="widest"
                      color="gray.500"
                      mb={1}
                    >
                      Name
                    </Text>
                    <Text
                      fontSize={{ base: "lg", md: "xl" }}
                      fontWeight="900"
                      noOfLines={1}
                    >
                      {tokenName}
                    </Text>
                  </Box>
                  <Box
                    flex={1}
                    bg="bauhaus.background"
                    border="3px solid"
                    borderColor="bauhaus.black"
                    p={4}
                    textAlign="center"
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="800"
                      textTransform="uppercase"
                      letterSpacing="widest"
                      color="gray.500"
                      mb={1}
                    >
                      Symbol
                    </Text>
                    <Text
                      fontSize={{ base: "lg", md: "xl" }}
                      fontWeight="900"
                      noOfLines={1}
                    >
                      {tokenSymbol}
                    </Text>
                  </Box>
                </HStack>
              )}

              {/* Tx Status */}
              {deployTxHash && (
                <HStack
                  w="full"
                  justify="center"
                  spacing={2}
                  bg="gray.50"
                  border="2px solid"
                  borderColor="gray.200"
                  px={4}
                  py={2}
                >
                  {isConfirming && (
                    <>
                      <Spinner size="xs" color="bauhaus.blue" />
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="gray.500"
                        textTransform="uppercase"
                      >
                        Confirming...
                      </Text>
                    </>
                  )}
                  <Link
                    href={`https://etherscan.io/tx/${deployTxHash}`}
                    isExternal
                    fontSize="xs"
                    fontWeight="700"
                    color="bauhaus.blue"
                    textTransform="uppercase"
                    display="inline-flex"
                    alignItems="center"
                    gap={1}
                  >
                    View on Etherscan
                    <ExternalLink size={10} />
                  </Link>
                </HStack>
              )}

              {/* Deployed Token Result */}
              {deployedAddress && (
                <Box
                  bg="green.50"
                  border="3px solid"
                  borderColor="green.500"
                  p={5}
                >
                  <VStack spacing={3}>
                    <HStack spacing={2}>
                      <CheckCircle size={20} color="#38A169" />
                      <Text
                        fontSize="sm"
                        fontWeight="800"
                        textTransform="uppercase"
                        color="green.600"
                      >
                        Token Deployed on Ethereum
                      </Text>
                    </HStack>
                    <Box
                      bg="white"
                      border="2px solid"
                      borderColor="green.300"
                      px={4}
                      py={3}
                      w="full"
                      textAlign="center"
                    >
                      <Text
                        fontSize="xs"
                        fontWeight="800"
                        textTransform="uppercase"
                        letterSpacing="widest"
                        color="gray.500"
                        mb={1}
                      >
                        L1 Token Address
                      </Text>
                      <Text
                        fontSize={{ base: "xs", md: "sm" }}
                        fontWeight="700"
                        fontFamily="mono"
                        wordBreak="break-all"
                      >
                        {deployedAddress}
                      </Text>
                    </Box>
                    <Link
                      href={`https://etherscan.io/address/${deployedAddress}`}
                      isExternal
                      fontSize="xs"
                      fontWeight="700"
                      color="bauhaus.blue"
                      textTransform="uppercase"
                      display="inline-flex"
                      alignItems="center"
                      gap={1}
                    >
                      View on Etherscan
                      <ExternalLink size={10} />
                    </Link>
                  </VStack>
                </Box>
              )}

              {/* Deploy Button */}
              <Button
                w="full"
                variant="secondary"
                size="lg"
                h="56px"
                fontSize="md"
                isDisabled={
                  !isConnected ||
                  !isValidAddress ||
                  !hasMetadata ||
                  isBusy ||
                  isWrongChain
                }
                isLoading={isBusy}
                loadingText={
                  isDeploying ? "Confirm in wallet..." : "Confirming..."
                }
                onClick={handleDeploy}
                leftIcon={<Rocket size={18} />}
              >
                Deploy Token on ETH Mainnet
              </Button>

              {!isConnected && (
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.400"
                  textAlign="center"
                  textTransform="uppercase"
                >
                  Connect wallet to deploy
                </Text>
              )}
            </VStack>
          </Box>
        </VStack>
      </Container>

      <Footer />
    </Box>
  );
}
