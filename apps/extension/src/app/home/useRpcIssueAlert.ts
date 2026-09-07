import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  getVisibleRpcIssueChainIds,
  INITIAL_RPC_ISSUE_ALERT_STATE,
  reduceRpcIssueAlertState,
  RPC_ISSUE_ALERT_REVEAL_DELAY_MS,
} from "./rpcIssueAlertModel";
import { useNetworks } from "@/contexts/NetworksContext";
import { getVisibleChains } from "@/lib/chains";
import type { RpcHealthReport } from "@/types";

export function useRpcIssueAlert() {
  const { networksInfo } = useNetworks();
  const eligibleChainIds = useMemo(
    () => new Set(
      networksInfo
        ? getVisibleChains(networksInfo).map((chain) => chain.chainId)
        : [],
    ),
    [networksInfo],
  );
  const eligibleChainIdsRef = useRef(eligibleChainIds);
  eligibleChainIdsRef.current = eligibleChainIds;
  const [state, dispatch] = useReducer(
    reduceRpcIssueAlertState,
    INITIAL_RPC_ISSUE_ALERT_STATE,
  );

  useEffect(() => {
    for (const chainId of state.reportedChainIds) {
      if (!eligibleChainIds.has(chainId)) dispatch({ type: "clear", chainId });
    }
  }, [eligibleChainIds, state.reportedChainIds]);

  useEffect(() => {
    if (state.pendingSince === null) return;
    const expectedChainIds = state.reportedChainIds;
    const remainingDelay = Math.max(
      0,
      state.pendingSince + RPC_ISSUE_ALERT_REVEAL_DELAY_MS - Date.now(),
    );
    const timer = window.setTimeout(() => {
      dispatch({ type: "reveal", expectedChainIds });
    }, remainingDelay);
    return () => window.clearTimeout(timer);
  }, [state.pendingSince, state.reportedChainIds]);

  const reportRpcIssues = useCallback((report: RpcHealthReport) => {
    dispatch({
      type: "report",
      ...report,
      // Detached refreshes may finish after visibility changed.
      checkedChainIds: report.checkedChainIds.filter((id) =>
        eligibleChainIdsRef.current.has(id),
      ),
      now: Date.now(),
    });
  }, []);
  const dismissRpcIssues = useCallback(() => {
    dispatch({ type: "dismiss" });
  }, []);
  const clearRpcIssue = useCallback((chainId: number) => {
    dispatch({ type: "clear", chainId });
  }, []);
  const visibleChainIds = useMemo(
    () => getVisibleRpcIssueChainIds(state).filter((id) => eligibleChainIds.has(id)),
    [state, eligibleChainIds],
  );

  return {
    visibleChainIds,
    reportRpcIssues,
    dismissRpcIssues,
    clearRpcIssue,
  };
}
