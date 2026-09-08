import { useEffect, useState } from "react";
import { Button, FormControl, FormErrorMessage, FormHelperText, FormLabel, Input } from "@chakra-ui/react";
import { getResolvedChainByName } from "@/lib/chains";
import type { NetworkEntry } from "@/types";

export function NetworkExplorerField({ chainName, entry, value, onChange }: {
  chainName: string;
  entry: NetworkEntry | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const isCustom = entry?.isCustom === true;
  const savedUrl = getResolvedChainByName(chainName, entry ? { [chainName]: entry } : undefined)?.explorer ?? "";
  const [draft, setDraft] = useState(savedUrl);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => { setDraft(savedUrl); setError(""); }, [chainName, savedUrl]);

  const save = async () => {
    if (!entry || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "updateNetwork",
        chainName,
        nextChainName: chainName,
        entry: { chainId: entry.chainId, rpcUrl: entry.rpcUrl, explorer: draft.trim() },
      });
      if (!response?.success) throw new Error(response?.error || "Failed to save explorer URL.");
      const resolved = getResolvedChainByName(chainName, response.networksInfo);
      setDraft(resolved?.explorer ?? draft.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save explorer URL.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormControl isInvalid={!!error}>
      <FormLabel mb={1.5} color="fg.secondary" fontSize="sm" fontWeight="500">
        Block explorer URL
      </FormLabel>
      <Input
        type="url"
        placeholder="https://explorer.example.com"
        value={isCustom ? value : draft}
        isDisabled={isSaving}
        onChange={(event) => {
          setError("");
          if (isCustom) onChange(event.target.value);
          else setDraft(event.target.value);
        }}
      />
      <FormErrorMessage>{error}</FormErrorMessage>
      {!isCustom && <FormHelperText>Leave blank to restore the default explorer.</FormHelperText>}
      {!isCustom && draft !== savedUrl && (
        <Button mt={3} variant="brand" isLoading={isSaving} onClick={() => void save()}>
          Save explorer URL
        </Button>
      )}
    </FormControl>
  );
}
