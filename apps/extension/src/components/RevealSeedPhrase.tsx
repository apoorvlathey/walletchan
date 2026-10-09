import { useState, useRef, useEffect, memo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  FormControl,
  FormLabel,
  InputGroup,
  InputRightElement,
  IconButton,
  Code,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  ViewIcon,
  ViewOffIcon,
  CopyIcon,
  CheckIcon,
  LockIcon,
} from "@chakra-ui/icons";
import type { Account, PasswordType } from "@/chrome/types";
import { useSeedBackupState } from "./SeedBackup/useSeedBackupState";
import { SeedBackupConfirmation } from "./SeedBackup/SeedBackupConfirmation";
import {
  AppHeader,
  AppScreen,
  ScreenBody,
  ScreenSection,
  StickyActionBar,
} from "@/components/ui";

interface Props {
  account: Account | null;
  onBack: () => void;
}

function RevealSeedPhrase({ account, onBack }: Props) {
  const backup = useSeedBackupState(account?.type === "seedPhrase" ? account.seedGroupId : undefined);
  const mountedRef = useRef(true);
  const revealRevision = useRef(0);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [passwordType, setPasswordType] = useState<PasswordType | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAgentPasswordEnabled, setIsAgentPasswordEnabled] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    revealRevision.current++;
    setMnemonic(""); setPassword(""); setShowPhrase(false);
    const onLock = (message: { type?: string }) => {
      if (message.type === "walletLockedExternal" || message.type === "walletLockFailedExternal") { revealRevision.current++; setMnemonic(""); setPassword(""); setShowPhrase(false); }
    };
    chrome.runtime.onMessage.addListener(onLock);
    return () => { mountedRef.current = false; chrome.runtime.onMessage.removeListener(onLock); };
  }, [account?.id]);
  useEffect(() => {
    setIsCheckingSession(true);
    chrome.runtime.sendMessage(
      { type: "getPasswordType" },
      (response: { passwordType: PasswordType | null }) => {
        setPasswordType(response.passwordType);
        setIsCheckingSession(false);
        if (response.passwordType !== "agent") {
          setTimeout(() => passwordInputRef.current?.focus(), 100);
        }
      },
    );
    chrome.runtime.sendMessage(
      { type: "isAgentPasswordEnabled" },
      (response: { enabled: boolean }) => {
        setIsAgentPasswordEnabled(response.enabled);
      },
    );
  }, []);

  const handleReveal = () => {
    if (!password || !account || account.type !== "seedPhrase" || backup.isLoading || backup.error) return;
    const revision = ++revealRevision.current;
    setError("");
    setIsLoading(true);

    chrome.runtime.sendMessage(
      { type: "revealSeedPhrase", seedGroupId: account.seedGroupId, password },
      (result: { success: boolean; mnemonic?: string; error?: string }) => {
        if (!mountedRef.current || revision !== revealRevision.current) return;
        setIsLoading(false);
        if (result.success && result.mnemonic) {
          setPassword("");
          setMnemonic(result.mnemonic);
        } else {
          setError(result.error || "Failed to reveal seed phrase");
        }
      },
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = mnemonic;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const revealed = !!mnemonic;
  const words = mnemonic.split(" ");

  return (
    <AppScreen>
      <AppHeader title={backup.pending ? "Back up your wallet" : "Reveal seed phrase"} onBack={onBack} />
      <ScreenBody pt={5}>
        {backup.error && !revealed && <Text role="alert" color="status.error.emphasis" fontSize="sm">{backup.error}. Reopen this screen to retry.</Text>}
        {isCheckingSession || backup.isLoading ? (
          <Text color="fg.secondary" fontSize="sm" aria-live="polite">
            Checking your session…
          </Text>
        ) : passwordType === "agent" ? (
          <VStack spacing={5} align="stretch">
            <ScreenSection
              title="Master password required"
              description="Seed phrases cannot be revealed while WalletChan is unlocked with an agent password."
            >
              <Box
                w="full"
                p={3}
                bg="status.warning.bg"
                border="1px solid"
                borderColor="status.warning.border"
                borderRadius="md"
              >
                <HStack spacing={2} align="start">
                  <LockIcon mt={0.5} color="status.warning.fg" />
                  <Text color="status.warning.fg" fontSize="sm" fontWeight="600">
                    Your agent session stays active, but secret access is blocked.
                  </Text>
                </HStack>
              </Box>
            </ScreenSection>

            <ScreenSection title="To continue">
              <VStack align="stretch" spacing={2} color="fg.secondary" fontSize="sm">
                <Text>1. Lock your wallet.</Text>
                <Text>2. Unlock with your master password.</Text>
                <Text>3. Open this account and reveal the phrase again.</Text>
              </VStack>
            </ScreenSection>
          </VStack>
        ) : !revealed ? (
          <VStack spacing={5} align="stretch">
            <ScreenSection
              title="Verify it’s you"
            >
              <FormControl isInvalid={!!error}>
                <FormLabel fontSize="sm" color="fg.secondary">Password</FormLabel>
                <InputGroup>
                  <Input
                    ref={passwordInputRef}
                    _focusVisible={{ borderColor: "accent.highlight", boxShadow: "0 0 0 1px var(--chakra-colors-accent-highlight)" }}
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      isAgentPasswordEnabled ? "Enter master password" : "Enter password"
                    }
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleReveal();
                    }}
                    isInvalid={!!error}
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                      color="fg.secondary"
                    />
                  </InputRightElement>
                </InputGroup>
                {error && (
                  <Text mt={2} color="status.error.emphasis" fontSize="sm" fontWeight="600" aria-live="polite">
                    {error}
                  </Text>
                )}
              </FormControl>
            </ScreenSection>
            <HStack spacing={3} align="start" p={3} bg="surface.raised" borderRadius="lg">
              <LockIcon color="accent.highlight" boxSize={4} mt={0.5} flexShrink={0} aria-hidden="true" />
              <Text fontSize="sm" color="fg.secondary" lineHeight="1.5">
                Keep your recovery phrase private. Anyone with it can control your wallet.
              </Text>
            </HStack>
          </VStack>
        ) : (
          <VStack spacing={5} align="stretch">
            <HStack spacing={3} align="start" p={3} bg="surface.raised" borderRadius="lg">
              <LockIcon color="accent.highlight" boxSize={4} mt={0.5} flexShrink={0} aria-hidden="true" />
              <Text fontSize="sm" color="fg.secondary" lineHeight="1.5">
                Save these words in order somewhere safe. Never share them.
              </Text>
            </HStack>

            <ScreenSection title="Recovery phrase">
              <Box
                w="full"
                p={3}
                bg="surface.sunken"
                border="1px solid"
                borderColor="border.default"
                borderRadius="lg"
              >
                <SimpleGrid columns={2} spacing={2}>
                  {words.map((word, index) => (
                    <HStack key={index} spacing={2} minW={0}>
                      <Text minW="20px" color="fg.muted" fontSize="xs" textAlign="end">
                        {index + 1}
                      </Text>
                      <Code
                        bg="transparent"
                        color="fg.primary"
                        fontFamily="mono"
                        fontSize="sm"
                        fontWeight="500"
                        noOfLines={1}
                      >
                        {showPhrase ? word : "••••"}
                      </Code>
                    </HStack>
                  ))}
                </SimpleGrid>
              </Box>

              <HStack spacing={2} mt={3}>
                <Button
                  variant="secondary"
                  leftIcon={showPhrase ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowPhrase(!showPhrase)}
                  flex={1}
                >
                  {showPhrase ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
                  onClick={handleCopy}
                  flex={1}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </HStack>
            </ScreenSection>
          </VStack>
        )}
      </ScreenBody>

      {!isCheckingSession && passwordType === "agent" && (
        <StickyActionBar
          primaryAction={<Button variant="secondary" onClick={onBack}>Back</Button>}
        />
      )}
      {!isCheckingSession && passwordType !== "agent" && !revealed && (
        <StickyActionBar
          secondaryAction={<Button variant="secondary" onClick={onBack}>Cancel</Button>}
          primaryAction={
            <Button
              variant="brand"
              onClick={handleReveal}
              isLoading={isLoading}
              loadingText="Verifying…"
              isDisabled={!password || backup.isLoading || !!backup.error}
            >
              Reveal phrase
            </Button>
          }
        />
      )}
      {revealed && backup.pending && <SeedBackupConfirmation isSaving={backup.isSaving} error={backup.error} onConfirm={() => { void backup.confirm().then((success) => { if (success && mountedRef.current) onBack(); }); }} />}
      {revealed && !backup.pending && (
        <StickyActionBar
          primaryAction={<Button variant="brand" onClick={onBack}>Done</Button>}
        />
      )}
    </AppScreen>
  );
}

export default memo(RevealSeedPhrase);
