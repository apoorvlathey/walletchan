import { Button, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { BackupConfirmationCheckbox } from "@/components/shared/BackupConfirmationCheckbox";
import { StickyActionBar } from "@/components/ui";

export function SeedBackupConfirmation({ isSaving, error, onConfirm }: {
  isSaving: boolean;
  error: string;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return <StickyActionBar
    summary={<VStack spacing={2} align="stretch">
      <BackupConfirmationCheckbox isChecked={confirmed} onChange={setConfirmed} label="I saved these words somewhere safe" />
      {error && <Text role="alert" fontSize="sm" color="status.error.emphasis">{error}</Text>}
    </VStack>}
    primaryAction={<Button variant="brand" isDisabled={!confirmed} isLoading={isSaving} onClick={onConfirm}>Finish backup</Button>}
  />;
}
