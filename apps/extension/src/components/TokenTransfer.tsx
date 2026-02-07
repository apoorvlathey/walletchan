import { useState, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Image,
  IconButton,
  InputGroup,
  InputRightElement,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";
import { PortfolioToken } from "@/chrome/portfolioApi";
import { buildTransferTx } from "@/chrome/transferUtils";
import { getChainConfig } from "@/constants/chainConfig";

interface TokenTransferProps {
  token: PortfolioToken;
  fromAddress: string;
  accountType: "bankr" | "privateKey" | "seedPhrase" | "impersonator";
  onBack: () => void;
  onTransferInitiated: () => void;
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function TokenTransfer({
  token,
  fromAddress,
  accountType,
  onBack,
  onTransferInitiated,
}: TokenTransferProps) {
  const toast = useBauhausToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chainConfig = getChainConfig(token.chainId);

  const handleMaxAmount = () => {
    setAmount(token.balanceFormatted.replace(/,/g, ""));
  };

  const isAmountValid = (): boolean => {
    if (!amount) return false;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;
    const balance = parseFloat(token.balanceFormatted.replace(/,/g, ""));
    return num <= balance;
  };

  const canSubmit = isValidAddress(recipient) && isAmountValid() && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (accountType === "impersonator") {
      toast({
        title: "View-only account",
        description: "Impersonator accounts cannot send transactions",
        status: "error",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const txParts = buildTransferTx({
        to: recipient,
        amount,
        contractAddress: token.contractAddress,
        decimals: token.decimals,
        chainId: token.chainId,
      });

      const result = await new Promise<{ success: boolean; txId?: string; error?: string }>(
        (resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "initiateTransfer",
              tx: {
                from: fromAddress,
                to: txParts.to,
                data: txParts.data,
                value: txParts.value,
                chainId: token.chainId,
              },
              chainName: chainConfig.name,
            },
            resolve
          );
        }
      );

      if (result.success) {
        onTransferInitiated();
      } else {
        toast({
          title: "Transfer failed",
          description: result.error || "Could not initiate transfer",
          status: "error",
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate transfer",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p={4} minH="100%" bg="bg.base">
      <VStack spacing={3} align="stretch">
        {/* Header */}
        <HStack spacing={2}>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
          <Text fontWeight="900" fontSize="lg" color="text.primary" textTransform="uppercase" letterSpacing="wider">
            Send {token.symbol}
          </Text>
        </HStack>

        {/* Token info card */}
        <Box
          bg="bauhaus.white"
          border="3px solid"
          borderColor="bauhaus.black"
          boxShadow="4px 4px 0px 0px #121212"
          p={3}
        >
          <HStack spacing={3}>
            <Box
              bg="bg.muted"
              border="2px solid"
              borderColor="bauhaus.black"
              borderRadius="sm"
              w="32px"
              h="32px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {token.logoUrl ? (
                <Image
                  src={token.logoUrl}
                  alt={token.symbol}
                  boxSize="28px"
                  fallback={
                    <Text fontSize="xs" fontWeight="800" color="text.secondary">
                      {token.symbol.slice(0, 3)}
                    </Text>
                  }
                />
              ) : (
                <Text fontSize="xs" fontWeight="800" color="text.secondary">
                  {token.symbol.slice(0, 3)}
                </Text>
              )}
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="sm" fontWeight="700" color="text.primary">
                {token.symbol}
              </Text>
              <Text fontSize="xs" color="text.tertiary">
                Balance: {token.balanceFormatted}
              </Text>
            </VStack>
            {chainConfig.icon && (
              <Image src={chainConfig.icon} alt={chainConfig.name} boxSize="20px" />
            )}
          </HStack>
        </Box>

        {/* Recipient input */}
        <Box>
          <Text fontSize="sm" fontWeight="700" color="text.secondary" textTransform="uppercase" mb={1}>
            Recipient
          </Text>
          <Input
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            fontFamily="mono"
            fontSize="sm"
            border="3px solid"
            borderColor={recipient && !isValidAddress(recipient) ? "bauhaus.red" : "bauhaus.black"}
            borderRadius="0"
            bg="bauhaus.white"
            _hover={{ borderColor: "bauhaus.blue" }}
            _focus={{ borderColor: "bauhaus.blue", boxShadow: "none" }}
          />
          {recipient && !isValidAddress(recipient) && (
            <Text fontSize="xs" color="bauhaus.red" fontWeight="700" mt={1}>
              Invalid address
            </Text>
          )}
        </Box>

        {/* Amount input */}
        <Box>
          <Text fontSize="sm" fontWeight="700" color="text.secondary" textTransform="uppercase" mb={1}>
            Amount
          </Text>
          <InputGroup>
            <Input
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) setAmount(val);
              }}
              fontFamily="mono"
              fontSize="sm"
              border="3px solid"
              borderColor="bauhaus.black"
              borderRadius="0"
              bg="bauhaus.white"
              _hover={{ borderColor: "bauhaus.blue" }}
              _focus={{ borderColor: "bauhaus.blue", boxShadow: "none" }}
              pr="60px"
            />
            <InputRightElement w="55px" h="full">
              <Button
                size="xs"
                variant="ghost"
                color="bauhaus.blue"
                fontWeight="800"
                onClick={handleMaxAmount}
                _hover={{ bg: "bg.muted" }}
              >
                MAX
              </Button>
            </InputRightElement>
          </InputGroup>
          {amount && !isAmountValid() && parseFloat(amount) > 0 && (
            <Text fontSize="xs" color="bauhaus.red" fontWeight="700" mt={1}>
              Insufficient balance
            </Text>
          )}
        </Box>

        {/* Impersonator warning */}
        {accountType === "impersonator" && (
          <Box
            bg="bauhaus.yellow"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="3px 3px 0px 0px #121212"
            p={3}
          >
            <Text fontSize="sm" color="bauhaus.black" fontWeight="700">
              View-only account — transfers are disabled.
            </Text>
          </Box>
        )}

        {/* Action buttons */}
        <HStack spacing={3} mt={2}>
          <Button
            variant="secondary"
            flex={1}
            onClick={onBack}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            flex={1}
            onClick={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!canSubmit || accountType === "impersonator"}
            bg="bauhaus.blue"
            color="white"
            border="3px solid"
            borderColor="bauhaus.black"
            boxShadow="4px 4px 0px 0px #121212"
            fontWeight="700"
            _hover={{
              bg: "bauhaus.blue",
              transform: "translateY(-2px)",
              boxShadow: "6px 6px 0px 0px #121212",
            }}
            _active={{
              transform: "translate(2px, 2px)",
              boxShadow: "none",
            }}
          >
            Send
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}

export default memo(TokenTransfer);
