import { useEffect, useRef, useState } from "react";
import { Box, Button, FormControl, FormLabel, HStack, Input, Progress, Text, VStack } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { safePortfolioBalances } from "@/components/SafeAccount/portfolioBalances";
import { fetchPortfolio } from "@/chrome/portfolio/api";
import { SafeIcon } from "@/components/shared/AccountTypeIcons";
import ChainIcon from "@/components/ChainIcon";
import { SafeVerificationCard } from "@/components/SafeAccount/SafeVerificationCard";
import { CHAIN_CONFIG } from "@/constants/chainRegistry";
import { KNOWN_CHAINS } from "@/constants/knownChains.generated";
import { OnboardingCanvas, OnboardingFooter, OnboardingHeader, OnboardingHint } from "./OnboardingShell";
import { probeOnboardingSafe, type SafeOnboardingSelection } from "./safeOnboarding";

export function SafeOnboardingStep({ selection, onBack, onProgressStepClick, onCollect }: {
  selection: SafeOnboardingSelection | null;
  onBack: () => void;
  onProgressStepClick: (step: number) => void;
  onCollect: (selection: SafeOnboardingSelection) => void;
}) {
  const [address, setAddress] = useState(selection?.address || "");
  const [verified, setVerified] = useState<SafeOnboardingSelection | null>(null);
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [checking, setChecking] = useState(false);
  const revision = useRef(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const generation = ++revision.current;
    setVerified(null); setError(""); setChecking(false);
    const candidate = address.trim();
    if (!/(?:^|:)(0x[0-9a-fA-F]{40})$/.test(candidate)) return;
    setChecking(true);
    const timer = setTimeout(() => {
      void probeOnboardingSafe(candidate).then((result) => {
        if (!cancelled && revision.current === generation) setVerified(result);
      }).catch((caught) => {
        if (!cancelled && revision.current === generation) setError(caught instanceof Error ? caught.message : "Could not check this Safe");
      }).finally(() => {
        if (!cancelled && revision.current === generation) setChecking(false);
      });
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, retry]);
  useEffect(() => {
    setBalances({});
    if (!verified) { setLoadingBalances(false); return; }
    const controller = new AbortController();
    let cancelled = false;
    setLoadingBalances(true);
    void fetchPortfolio(verified.address, controller.signal).then((portfolio) => {
      if (cancelled) return;
      setBalances(safePortfolioBalances(portfolio));
    }).catch(() => { /* A failed fetch leaves the balance unavailable. */ }).finally(() => {
      if (!cancelled) setLoadingBalances(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [verified]);
  const differentConfigurations = new Set(verified?.snapshots.map((snapshot) => snapshot.configEpoch)).size > 1;
  return <OnboardingCanvas currentStep={1} onStepClick={onProgressStepClick}
    header={<OnboardingHeader onBack={onBack} step={1} />}
    footer={<OnboardingFooter><Button variant="brand" size="lg" w="full" isDisabled={!verified || checking}
      onClick={() => { if (verified) onCollect(verified); }}>{verified?.snapshots.every((snapshot) => snapshot.capability === "blocked") ? "Continue as view-only" : "Continue"}</Button></OnboardingFooter>}>
    <VStack align="stretch" spacing={5}>
      <Text as="h1" fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">Connect Safe</Text>
      <FormControl isInvalid={!!error}>
        <FormLabel fontSize="sm" fontWeight="600">Safe address</FormLabel>
        <Input autoFocus value={address} placeholder="0x… or chainId:0x…" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(event) => { revision.current++; setVerified(null); setAddress(event.target.value); }} />
      </FormControl>
      {checking && <VStack align="stretch" spacing={2} role="status" aria-live="polite">
        <Text fontSize="sm" color="fg.secondary">Checking networks…</Text>
        <Progress isIndeterminate aria-label="Checking Safe networks" size="xs" borderRadius="full" bg="surface.raised"
          sx={{ "& > div": { bg: "accent.highlight" } }} />
      </VStack>}
      {error && <VStack align="start" spacing={2}><Text role="alert" fontSize="sm" color="status.error.emphasis">{error}</Text><Button variant="secondary" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button></VStack>}
      {verified && <VStack align="stretch" spacing={2}>
        <Text fontSize="sm" fontWeight="600">Verified networks</Text>
        {!!verified.failures?.length && <HStack justify="space-between"><Text fontSize="xs" color="fg.secondary">{verified.failures.length} networks could not be checked.</Text><Button variant="ghost" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button></HStack>}
        {differentConfigurations && <Text fontSize="sm" color="status.warning.emphasis">Owners or security settings differ across networks. Review each network below.</Text>}
        {verified.snapshots.map((snapshot) => {
          const chain = CHAIN_CONFIG[snapshot.chainId] ?? KNOWN_CHAINS[snapshot.chainId];
          const name = chain?.name || `Chain ${snapshot.chainId}`;
          return <Box as="details" open={differentConfigurations || snapshot.capability === "blocked" ? true : undefined} key={snapshot.chainId} border="1px solid" borderColor="border.default" borderRadius="lg" overflow="hidden"
            sx={{ "& > summary": { listStyle: "none" }, "& > summary::-webkit-details-marker": { display: "none" }, "&[open] > summary .safe-network-chevron": { transform: "rotate(180deg)" } }}>
            <Box as="summary" p={3} display="flex" alignItems="center" justifyContent="space-between" gap={3} cursor="pointer" _focusVisible={{ outline: "2px solid", outlineColor: "border.focus" }}>
              <HStack as="span" display="inline-flex" spacing={2.5}>
                <ChainIcon chainId={snapshot.chainId} chainName={name} size="24px" />
                <Box as="span"><Text as="span" fontSize="sm" fontWeight="600">{name}</Text><Text fontSize="xs" color="fg.secondary">{snapshot.threshold} of {snapshot.owners.length} owners · Safe {snapshot.version}{snapshot.capability === "blocked" ? " · View-only" : ""}</Text></Box>
              </HStack>
              <ChevronDownIcon className="safe-network-chevron" color="fg.muted" boxSize={5} flexShrink={0} aria-hidden="true" />
            </Box>
            <SafeVerificationCard snapshot={snapshot} chain={chain} safeAddress={verified.address} accounts={[]} balanceUsd={balances[snapshot.chainId]} isLoadingBalance={loadingBalances} showCapability={false} />
            {snapshot.blockedReason && <Text px={3} pb={3} fontSize="sm" color="status.warning.emphasis">{snapshot.blockedReason}</Text>}
          </Box>;
        })}
      </VStack>}
      <OnboardingHint icon={<SafeIcon boxSize="18px" color="status.success.emphasis" />}>
        <Text fontSize="sm" color="fg.secondary">Connect an owner account later to approve transactions.</Text>
      </OnboardingHint>
    </VStack>
  </OnboardingCanvas>;
}
