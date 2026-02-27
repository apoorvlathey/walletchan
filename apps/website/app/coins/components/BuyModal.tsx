"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  CloseButton,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Box,
  Flex,
  Icon,
  Image,
} from "@chakra-ui/react";
import { useAccount, useBalance, useEnsName, useChainId, useSwitchChain } from "wagmi";
import {
  useConnectModal,
  useAccountModal,
} from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { base, mainnet } from "wagmi/chains";
import { Copy, Check } from "lucide-react";
import { LoadingShapes } from "../../components/ui/LoadingShapes";
import { useSwapQuote, formatTokenAmount } from "../../swap/hooks/useSwapQuote";
import {
  NATIVE_TOKEN_ADDRESS,
  DEFAULT_SLIPPAGE_BPS,
  SWAP_CHAIN_ID,
} from "../../swap/constants";
import { DEFAULT_SLIPPAGE_BPS as WCHAN_DEFAULT_SLIPPAGE_BPS } from "../../../lib/wchan-swap";
import { QuoteDisplay } from "../../swap/components/QuoteDisplay";
import { SwapButton } from "../../swap/components/SwapButton";
import { SlippageSettings } from "../../swap/components/SlippageSettings";
import { WchanBuyContent } from "./WchanBuyContent";
import { TOKEN_ADDRESS } from "../../constants";

export interface BuyToken {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  tokenURI?: string;
}

function ArrowDownIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12 4v12.17l-4.59-4.58L6 13l6 6 6-6-1.41-1.41L12 16.17V4z"
      />
    </Icon>
  );
}

interface TokenURIMetadata {
  image?: string;
}

function useCoinImage(tokenURI: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenURI) return;
    let cancelled = false;

    async function fetchMetadata() {
      try {
        const res = await fetch(tokenURI!);
        if (!res.ok || cancelled) return;
        const data: TokenURIMetadata = await res.json();
        if (!cancelled && data.image) {
          setImageUrl(data.image);
        }
      } catch {
        // Ignore fetch errors
      }
    }

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [tokenURI]);

  return imageUrl;
}

function WalletDisplay() {
  const { address } = useAccount();
  const { openAccountModal } = useAccountModal();
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });

  if (!address) return null;

  const displayName = ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Box
      as="button"
      onClick={openAccountModal}
      display="flex"
      alignItems="center"
      border="2px solid"
      borderColor="bauhaus.black"
      px={3}
      py={1}
      bg="white"
      fontWeight="800"
      fontSize="xs"
      textTransform="uppercase"
      letterSpacing="wide"
      _hover={{ bg: "gray.50" }}
      transition="background 0.15s"
    >
      {displayName}
      <Text ml={1} fontSize="xs" color="gray.500">
        ▾
      </Text>
    </Box>
  );
}

const ETH_PRESETS = ["1", "0.1", "0.01", "0.001"];

interface BuyModalProps {
  token: BuyToken | null;
  isOpen: boolean;
  onClose: () => void;
  showWallet?: boolean;
}

export function BuyModal({ token, isOpen, onClose, showWallet }: BuyModalProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== SWAP_CHAIN_ID;

  const [sellAmount, setSellAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [copied, setCopied] = useState(false);
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);

  const fetchedImageUrl = useCoinImage(token?.tokenURI);
  const imageUrl = token?.imageUrl ?? fetchedImageUrl;

  // Fetch ETH/USD price
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function fetchPrice() {
      try {
        const res = await fetch("/api/eth-price");
        const data = await res.json();
        if (!cancelled && data?.ethereum?.usd) {
          setEthUsdPrice(data.ethereum.usd);
        }
      } catch {
        // ignore
      }
    }
    fetchPrice();
    return () => { cancelled = true; };
  }, [isOpen]);

  const sellToken = NATIVE_TOKEN_ADDRESS;
  const buyTokenAddress = token?.address ?? "";
  const isWchan =
    !!buyTokenAddress &&
    buyTokenAddress.toLowerCase() === TOKEN_ADDRESS.toLowerCase();

  // Reset form when token changes or modal closes
  useEffect(() => {
    if (!isOpen) {
      setSellAmount("");
      setSlippageBps(
        isWchan ? WCHAN_DEFAULT_SLIPPAGE_BPS : DEFAULT_SLIPPAGE_BPS
      );
      setCopied(false);
    }
  }, [isOpen, isWchan]);

  // Fetch ETH balance on Base
  const { data: ethBalance, refetch: refetchBalance } = useBalance({
    address,
    chainId: base.id,
    query: { enabled: !!address },
  });

  // Token info from token props (avoids RPC calls since we already have the data)
  const buyTokenInfo = token
    ? { name: token.name, symbol: token.symbol, decimals: 18 }
    : null;
  const sellTokenInfo = { name: "Ether", symbol: "ETH", decimals: 18 };

  const sellAmountValid = useMemo(() => {
    if (!sellAmount) return false;
    const num = parseFloat(sellAmount);
    return !isNaN(num) && num > 0;
  }, [sellAmount]);

  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    fetchFirmQuote,
  } = useSwapQuote({
    sellToken,
    buyToken: buyTokenAddress,
    sellAmountEth: sellAmount,
    taker: address,
    slippageBps,
    enabled: !isWchan && !!buyTokenAddress && sellAmountValid && isOpen,
  });

  const formattedBalance = ethBalance
    ? parseFloat(formatEther(ethBalance.value)).toFixed(4)
    : null;

  const handleMaxClick = useCallback(() => {
    if (ethBalance) {
      const max = ethBalance.value - BigInt(5e15); // ~0.005 ETH for gas
      if (max > 0n) {
        setSellAmount(parseFloat(formatEther(max)).toString());
      }
    }
  }, [ethBalance]);

  const handleTxConfirmed = useCallback(() => {
    refetchBalance();
  }, [refetchBalance]);

  const outputAmount =
    quote && buyTokenInfo
      ? formatTokenAmount(quote.buyAmount, buyTokenInfo.decimals)
      : "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent
        bg="white"
        border="4px solid"
        borderColor="bauhaus.black"
        borderRadius={0}
        boxShadow="8px 8px 0px 0px #121212"
        mx={4}
      >
        <ModalHeader pb={2} pt={5} px={6}>
          <HStack justify="space-between" align="center">
            <HStack spacing={3}>
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt={token?.name}
                  w="36px"
                  h="36px"
                  border="2px solid"
                  borderColor="bauhaus.black"
                  objectFit="cover"
                />
              )}
              <VStack align="flex-start" spacing={0}>
                <Text
                  fontWeight="900"
                  fontSize="lg"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  lineHeight="1.2"
                >
                  ${token?.symbol}
                </Text>
                <Text fontSize="sm" color="gray.600" fontWeight="600">
                  {token?.name}
                </Text>
                {token?.address && (
                  <HStack spacing={1}>
                    <Text fontSize="xs" color="gray.400" fontFamily="mono">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </Text>
                    <Box
                      as="button"
                      onClick={() => {
                        navigator.clipboard.writeText(token.address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      color={copied ? "green.500" : "gray.400"}
                      _hover={{ color: copied ? "green.500" : "gray.600" }}
                      display="flex"
                      alignItems="center"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </Box>
                  </HStack>
                )}
              </VStack>
            </HStack>
            <HStack spacing={2}>
              {showWallet && isConnected && <WalletDisplay />}
              <CloseButton size="sm" borderRadius={0} onClick={onClose} />
            </HStack>
          </HStack>
        </ModalHeader>

        <ModalBody px={6} pb={6}>
          <VStack spacing={5} align="stretch">
            {/* You Pay + You Receive */}
            <Box>
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="widest"
                  >
                    You Pay
                  </Text>
                  {isConnected && formattedBalance && (
                    <HStack spacing={1}>
                      <Text
                        fontSize="xs"
                        color="gray.500"
                        fontWeight="medium"
                      >
                        Balance: {formattedBalance} ETH
                      </Text>
                      <Box
                        as="button"
                        fontSize="xs"
                        fontWeight="bold"
                        color="bauhaus.blue"
                        textTransform="uppercase"
                        onClick={handleMaxClick}
                        _hover={{ textDecoration: "underline" }}
                      >
                        Max
                      </Box>
                    </HStack>
                  )}
                </HStack>
                <HStack
                  border="2px solid"
                  borderColor="bauhaus.border"
                  p={3}
                  spacing={3}
                >
                  <Input
                    placeholder="0.0"
                    value={sellAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setSellAmount(val);
                      }
                    }}
                    border="none"
                    _focus={{ boxShadow: "none" }}
                    fontSize="xl"
                    fontWeight="black"
                    p={0}
                    flex={1}
                  />
                  {sellAmountValid && ethUsdPrice && (
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="gray.400"
                      whiteSpace="nowrap"
                      flexShrink={0}
                    >
                      ≈ ${(parseFloat(sellAmount) * ethUsdPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </HStack>
                <HStack spacing={{ base: 1, sm: 2 }} mt={2}>
                  {ETH_PRESETS.map((preset) => (
                    <Box
                      key={preset}
                      as="button"
                      flex={1}
                      py={1}
                      px={1}
                      border="2px solid"
                      borderColor={sellAmount === preset ? "bauhaus.blue" : "bauhaus.black"}
                      bg={sellAmount === preset ? "bauhaus.blue" : "white"}
                      color={sellAmount === preset ? "white" : "bauhaus.black"}
                      fontSize={{ base: "10px", sm: "xs" }}
                      fontWeight="800"
                      textAlign="center"
                      textTransform="uppercase"
                      whiteSpace="nowrap"
                      onClick={() => setSellAmount(preset)}
                      _hover={{ bg: sellAmount === preset ? "bauhaus.blue" : "gray.100" }}
                    >
                      {preset} ETH
                    </Box>
                  ))}
                </HStack>
              </Box>

              {/* Arrow separator */}
              <Flex justify="center" mt={3} mb={{ base: 1, sm: -3 }} zIndex={2} position="relative">
                <Flex
                  w={8}
                  h={8}
                  bg="bauhaus.blue"
                  color="white"
                  align="center"
                  justify="center"
                  border="3px solid white"
                >
                  <ArrowDownIcon boxSize={4} />
                </Flex>
              </Flex>

              {/* You Receive (0x flow only) */}
              {!isWchan && (
                <Box>
                  <HStack justify="space-between" mb={2}>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="widest"
                    >
                      You Receive
                    </Text>
                    <SlippageSettings
                      slippageBps={slippageBps}
                      onSlippageChange={setSlippageBps}
                    />
                  </HStack>
                  <HStack
                    border="2px solid"
                    borderColor="bauhaus.border"
                    p={3}
                    spacing={3}
                    bg="gray.50"
                  >
                    <Input
                      placeholder={
                        quote === null && !isQuoteLoading ? "\u2014" : "0.0"
                      }
                      value={isQuoteLoading ? "" : outputAmount}
                      readOnly
                      border="none"
                      _focus={{ boxShadow: "none" }}
                      fontSize="xl"
                      fontWeight="black"
                      p={0}
                      flex={1}
                      cursor="default"
                      tabIndex={-1}
                    />
                    {isQuoteLoading && <LoadingShapes />}
                    {buyTokenInfo && (
                      <Flex
                        bg="bauhaus.blue"
                        color="white"
                        px={3}
                        py={1}
                        align="center"
                        flexShrink={0}
                      >
                        <Text
                          fontWeight="bold"
                          fontSize="sm"
                          textTransform="uppercase"
                        >
                          {buyTokenInfo.symbol}
                        </Text>
                      </Flex>
                    )}
                  </HStack>
                </Box>
              )}

            </Box>

            {isWchan ? (
              <WchanBuyContent
                sellAmount={sellAmount}
                sellAmountValid={sellAmountValid}
                slippageBps={slippageBps}
                onSlippageChange={setSlippageBps}
                buyTokenSymbol={buyTokenInfo?.symbol ?? "WCHAN"}
                ethBalanceWei={ethBalance?.value}
                onTxConfirmed={handleTxConfirmed}
              />
            ) : (
              <>
                {/* Quote breakdown */}
                {quote && !isQuoteLoading && buyTokenInfo && sellTokenInfo && (
                  <QuoteDisplay
                    quote={quote}
                    buyTokenSymbol={buyTokenInfo.symbol}
                    buyTokenDecimals={buyTokenInfo.decimals}
                    sellTokenSymbol={sellTokenInfo.symbol}
                    sellTokenDecimals={sellTokenInfo.decimals}
                  />
                )}

                {/* Error display */}
                {quoteError && (
                  <Text
                    fontSize="sm"
                    color="bauhaus.red"
                    fontWeight="bold"
                    textAlign="center"
                  >
                    {quoteError}
                  </Text>
                )}

                {/* Action button */}
                {!isConnected ? (
                  <Button
                    variant="primary"
                    size="lg"
                    w="full"
                    onClick={openConnectModal}
                    fontSize="md"
                    py={6}
                  >
                    Connect Wallet
                  </Button>
                ) : isWrongChain ? (
                  <Button
                    size="lg"
                    w="full"
                    bg="orange.500"
                    color="white"
                    fontWeight="900"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    borderRadius={0}
                    border="3px solid"
                    borderColor="bauhaus.black"
                    fontSize="md"
                    py={6}
                    _hover={{ bg: "orange.600" }}
                    onClick={() => switchChain({ chainId: SWAP_CHAIN_ID })}
                    leftIcon={<Image src="/images/base.svg" alt="Base" w="20px" h="20px" />}
                  >
                    Switch to Base
                  </Button>
                ) : (
                  <SwapButton
                    sellToken={sellToken}
                    quote={quote}
                    fetchFirmQuote={fetchFirmQuote}
                    isQuoteLoading={isQuoteLoading}
                    sellAmountValid={sellAmountValid}
                    onTxConfirmed={handleTxConfirmed}
                  />
                )}
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
