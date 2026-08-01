import { useEffect, useState } from "react";
import { Spacer, Spinner, Switch } from "@chakra-ui/react";
import {
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemTitle,
  ListSurface,
} from "@/components/ui";
import {
  getExplorerEnhancementsEnabled,
  setExplorerEnhancementsEnabled,
} from "@/lib/explorerEnhancementPreference";
import { SettingsRow } from "./SettingsRow";
import { SettingsScreenFrame } from "./SettingsScreenFrame";
import { ExplorerIcon } from "./icons";

interface ExplorerEnhancementsSettingsProps {
  onBack: () => void;
}

export function ExplorerEnhancementsSettingsRow({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <SettingsRow
      title="Enhance Block Explorers"
      subtitle="Decode tx details on Etherscan, etc."
      icon={<ExplorerIcon boxSize={5} />}
      iconBg="accent.secondary"
      iconColor="accentFg.secondary"
      cornerAccent="secondary"
      showChevron
      onClick={onClick}
    />
  );
}

export default function ExplorerEnhancementsSettings({
  onBack,
}: ExplorerEnhancementsSettingsProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void getExplorerEnhancementsEnabled().then((stored) => {
      if (active) setEnabled(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    if (enabled === null || pending) return;
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    try {
      await setExplorerEnhancementsEnabled(next);
    } catch {
      setEnabled(enabled);
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsScreenFrame title="Enhance Block Explorers" onBack={onBack}>
      <ListSurface aria-label="Block explorer enhancement preference">
        <ListItem>
          <ListItemContent>
            <ListItemTitle>WalletChan transaction details</ListItemTitle>
            <ListItemDescription>
              Add decoded transaction details to supported block explorers.
            </ListItemDescription>
          </ListItemContent>
          <Spacer />
          {enabled === null ? (
            <Spinner size="sm" />
          ) : (
            <Switch
              aria-label="Enhance block explorers with WalletChan transaction details"
              isChecked={enabled}
              isDisabled={pending}
              onChange={() => void toggle()}
            />
          )}
        </ListItem>
      </ListSurface>
    </SettingsScreenFrame>
  );
}
