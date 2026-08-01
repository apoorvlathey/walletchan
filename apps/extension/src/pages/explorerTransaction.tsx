import ReactDOM from "react-dom/client";
import { Box } from "@chakra-ui/react";
import { useEffect } from "react";

import ExplorerTransactionPanel, {
  ExplorerTransactionError,
  ExplorerTransactionLoading,
} from "@/components/ExplorerTransaction/ExplorerTransactionPanel";
import { useExplorerTransaction } from "@/components/ExplorerTransaction/useExplorerTransaction";
import { NetworksProvider } from "@/contexts/NetworksContext";
import { ThemeProvider } from "@/theme";
import { bootstrapThemeAttribute } from "@/theme/bootstrap";
import "./explorerTransaction.css";

const query = new URLSearchParams(window.location.search);
const sourcePageUrl = query.get("page");
const token = query.get("token") || "";

function postHostMessage(type: "resize" | "dismiss", height?: number): void {
  void chrome.runtime
    .sendMessage({
      type: "EXPLORER_TRANSACTION_FRAME_EVENT",
      token,
      action: type,
      height,
    })
    .catch(() => {});
}

export function ExplorerTransactionRoot() {
  const { state, retry } = useExplorerTransaction(sourcePageUrl);

  useEffect(() => {
    if (state.status === "unsupported") {
      postHostMessage("dismiss");
      return;
    }
    if (state.status === "resolving") return;
    const root = document.getElementById("explorer-root");
    if (!root) return;
    const publishHeight = () => {
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height > 0) postHostMessage("resize", height);
    };
    const animationFrame = requestAnimationFrame(publishHeight);
    const observer = new ResizeObserver(publishHeight);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [state.status]);

  if (state.status === "resolving" || state.status === "unsupported") return null;
  return (
    <Box py={1}>
      {state.status === "loading" && <ExplorerTransactionLoading page={state.page} />}
      {state.status === "error" && (
        <ExplorerTransactionError
          page={state.page}
          message={state.message}
          onRetry={retry}
        />
      )}
      {state.status === "ready" && (
        <ExplorerTransactionPanel page={state.page} transaction={state.transaction} />
      )}
    </Box>
  );
}

bootstrapThemeAttribute();

ReactDOM.createRoot(document.getElementById("explorer-root")!).render(
  <ThemeProvider>
    <NetworksProvider>
      <ExplorerTransactionRoot />
    </NetworksProvider>
  </ThemeProvider>,
);
