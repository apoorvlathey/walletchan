import { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Button,
  Text,
  Box,
  HStack,
} from "@chakra-ui/react";
import { CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

export function QRCodeModal({ isOpen, onClose, address }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const addressLines = address.match(/.{1,6}/g) ?? [];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay bg="surface.overlay" />
      <ModalContent mx={4}>
        <ModalHeader
          color="fg.primary"
          fontWeight="600"
          fontSize="md"
          py={4}
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          Receive
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={5} px={4}>
          <VStack spacing={4}>
            <HStack
              spacing={4}
              w="full"
              maxW="320px"
              align="stretch"
              sx={{ containerType: "inline-size" }}
            >
              {/* Keep the QR on a white tile for scanning in every theme. */}
              <Box
                flex="1"
                minW={0}
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="lg"
                p={2.5}
                bg="white"
                sx={{ "& svg": { display: "block", width: "100%", height: "auto" } }}
              >
                <QRCodeSVG
                  title="Wallet address QR code"
                  value={address}
                  size={200}
                  level="H"
                  imageSettings={{
                    src: "walletchan-icon-white-bg.png",
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </Box>

              {/* Six characters per line keeps the full address beside the QR. */}
              <Text
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                flexShrink={0}
                fontFamily="mono"
                fontSize="calc((100cqw - 16px) / 13)"
                fontWeight="500"
                color="fg.secondary"
                whiteSpace="nowrap"
                lineHeight="1"
              >
                {addressLines.map((line, index) => (
                  <Text as="span" display="block" key={index}>
                    {index === 0 ? (
                      <Text as="span" color="fg.primary" fontWeight="600">{line}</Text>
                    ) : index === addressLines.length - 1 ? (
                      <>
                        {line.slice(0, -4)}
                        <Text as="span" color="fg.primary" fontWeight="600">{line.slice(-4)}</Text>
                      </>
                    ) : line}
                  </Text>
                ))}
              </Text>
            </HStack>

            {/* Copy address button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              color={copied ? "status.success.emphasis" : "accent.secondary"}
              leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
            >
              {copied ? "Copied" : "Copy address"}
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
