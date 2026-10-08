import { ChevronDownIcon } from "@chakra-ui/icons";
import { Box, HStack, IconButton, Menu, MenuButton, MenuItem, MenuList, Portal } from "@chakra-ui/react";
import LoadingDots from "@/components/LoadingDots";
import { SimulationFailureConfirmButton } from "@/components/RequestConfirmation/SimulationFailureConfirmButton";

export function SafeProposalPrimaryAction({ eligible, combined, isLoading, isPreparing = false, hideDropdown = false, disabledReason, acknowledgementRequired, simulationFailed, requestKind, label, onConfirm, onOffchain, onCombined }: {
  eligible: boolean; combined: boolean; isLoading: boolean; disabledReason: string | null;
  acknowledgementRequired: boolean; simulationFailed: boolean; requestKind: "transaction" | "batch";
  label: string; onConfirm: () => void; onOffchain: () => void; onCombined: () => void;
  isPreparing?: boolean;
  hideDropdown?: boolean;
}) {
  const preparing = isPreparing && !isLoading;
  const showDropdown = eligible && !hideDropdown;
  const button = <SimulationFailureConfirmButton
    acknowledgementRequired={acknowledgementRequired} disabledReason={disabledReason}
    isDisabled={!!disabledReason} isLoading={isLoading || preparing} label={combined ? "Sign & Execute" : label}
    loadingSpinner={<Box transform={showDropdown ? "translateX(8px)" : undefined}><LoadingDots color="currentColor" /></Box>}
    onConfirm={onConfirm} requestKind={requestKind} simulationFailed={simulationFailed}
  />;
  if (!showDropdown) return button;
  return (
    <HStack spacing={0} w="full" align="stretch" opacity={disabledReason && !isLoading && !preparing ? 0.5 : 1}>
      <Box flex={1} minW={0} sx={{ "button": {
        borderTopRightRadius: 0, borderBottomRightRadius: 0,
        paddingInlineStart: "16px", paddingInlineEnd: 0,
        _disabled: { opacity: 1 },
        _hover: { _disabled: { opacity: 1 } },
      } }}>{button}</Box>
      <Menu placement="top-end" isLazy>
        <MenuButton
          as={IconButton} icon={<ChevronDownIcon />} variant="brand" w="36px" minW="36px"
          aria-label="Choose Safe signing action" isDisabled={isLoading}
          borderLeft="1px solid" borderLeftColor="border.subtle"
          borderTopLeftRadius={0} borderBottomLeftRadius={0}
          _disabled={{ opacity: 1 }}
        />
        <Portal><MenuList>
          <MenuItem onClick={onCombined} aria-current={combined ? "true" : undefined}>Sign & Execute</MenuItem>
          <MenuItem onClick={onOffchain} aria-current={!combined ? "true" : undefined}>Sign offchain</MenuItem>
        </MenuList></Portal>
      </Menu>
    </HStack>
  );
}
