"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";

const POLLING_INTERVAL = 30_000; // 30 seconds

export interface VaultData {
  apr: number;
  apy7Day: number;
  apy30Day: number;
  tvl: string;
  tvlUsd: number;
  utilizationRate: number;
  vaultAddress: string;
  vaultSymbol: string;
  vaultName: string;
  tokenDecimals: number;
}

interface VaultDataContextType {
  vaultData: VaultData | null;
  isLoading: boolean;
  refetchVaultData: () => void;
}

const VaultDataContext = createContext<VaultDataContextType>({
  vaultData: null,
  isLoading: true,
  refetchVaultData: () => {},
});

export function VaultDataProvider({ children }: { children: ReactNode }) {
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVaultData = useCallback(async () => {
    try {
      const res = await fetch("/api/stake/vault");
      if (!res.ok) throw new Error("Failed to fetch vault data");

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        setVaultData({
          apr: item.apr ?? 0,
          apy7Day: item.apy7Day ?? 0,
          apy30Day: item.apy30Day ?? 0,
          tvl: item.tvl,
          tvlUsd: item.tvlUsd ?? 0,
          utilizationRate: item.utilizationRate ?? 0,
          vaultAddress: item.vault?.address ?? "",
          vaultSymbol: item.vault?.symbol ?? "sBNKRW",
          vaultName: item.vault?.name ?? "Spicy BNKRW Vault",
          tokenDecimals: item.token?.decimals ?? 18,
        });
        setIsLoading(false);
      } else {
        throw new Error("No vault data");
      }
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      retryTimeoutRef.current = setTimeout(() => {
        fetchVaultData();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    fetchVaultData();
    const interval = setInterval(() => fetchVaultData(), POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchVaultData]);

  return (
    // @ts-expect-error React 19 types conflict with monorepo React 18 types
    <VaultDataContext.Provider value={{ vaultData, isLoading, refetchVaultData: fetchVaultData }}>
      {children}
    </VaultDataContext.Provider>
  );
}

export function useVaultData() {
  return useContext(VaultDataContext);
}
