import { useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { useBauhausToast } from "@/hooks/useBauhausToast";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useBauhausToast();

  return (
    <IconButton
      aria-label="Copy"
      icon={copied ? <CheckIcon /> : <CopyIcon />}
      size="xs"
      variant="ghost"
      color={copied ? "bauhaus.yellow" : "text.secondary"}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast({ title: "Copied!", status: "success", duration: 1500 });
        setTimeout(() => setCopied(false), 2000);
      }}
      _hover={{ color: "bauhaus.blue", bg: "bg.muted" }}
    />
  );
}
