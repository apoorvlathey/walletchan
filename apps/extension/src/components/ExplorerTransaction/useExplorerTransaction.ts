import { useCallback, useEffect, useState } from "react";

import { fetchRpcResult } from "@/chrome/network/rpcClient";
import { getStoredNetworksInfo } from "@/lib/chains";
import {
  parseExplorerRpcTransaction,
  resolveExplorerTransactionPage,
  type ExplorerRpcTransaction,
  type ExplorerTransactionPage,
} from "@/lib/explorerTransaction";

type ExplorerTransactionState =
  | { status: "resolving" }
  | { status: "unsupported" }
  | { status: "loading"; page: ExplorerTransactionPage }
  | { status: "ready"; page: ExplorerTransactionPage; transaction: ExplorerRpcTransaction }
  | { status: "error"; page: ExplorerTransactionPage; message: string };

export function useExplorerTransaction(sourcePageUrl: string | null): {
  state: ExplorerTransactionState;
  retry: () => void;
} {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<ExplorerTransactionState>({
    status: "resolving",
  });
  const retry = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "resolving" });

    void (async () => {
      const page = resolveExplorerTransactionPage(
        sourcePageUrl,
        await getStoredNetworksInfo(),
      );
      if (cancelled) return;
      if (!page || !page.chain.rpcUrl) {
        setState({ status: "unsupported" });
        return;
      }
      setState({ status: "loading", page });

      try {
        const [rpcChainId, rawTransaction] = await Promise.all([
          fetchRpcResult(page.chain.rpcUrl, "eth_chainId", [], {
            timeoutMs: 8_000,
            maxResponseBytes: 64_000,
            allowPrivateWithoutOrigin: true,
          }),
          fetchRpcResult(
            page.chain.rpcUrl,
            "eth_getTransactionByHash",
            [page.txHash],
            {
              timeoutMs: 12_000,
              maxResponseBytes: 2_100_000,
              allowPrivateWithoutOrigin: true,
            },
          ),
        ]);
        if (cancelled) return;
        if (Number(rpcChainId) !== page.chain.chainId) {
          throw new Error("The configured RPC returned a different network");
        }
        const transaction = parseExplorerRpcTransaction(
          rawTransaction,
          page.txHash,
        );
        if (!transaction) {
          throw new Error("The RPC did not return the transaction shown by this explorer");
        }
        setState({ status: "ready", page, transaction });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          page,
          message:
            error instanceof Error
              ? error.message
              : "Transaction details are unavailable from the configured RPC",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [generation, sourcePageUrl]);

  return { state, retry };
}
