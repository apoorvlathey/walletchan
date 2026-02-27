"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { formatUnits } from "viem";
import { useTokenData } from "./TokenDataContext";

const INDEXER_URL =
  process.env.NEXT_PUBLIC_WCHAN_VAULT_INDEXER_API_URL || "";
const POLLING_INTERVAL = 30_000;
const ETH_PRICE_URL = "/api/eth-price";

export interface VaultData {
  totalApy: number;
  wchanApy: number;
  wethApy: number;
  totalStaked: string;
  tvlUsd: number;
  sharePrice: string;
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

function computeWethApy(
  wethDistributed: string,
  totalStaked: string,
  secondsElapsed: number,
  ethPrice: number,
  wchanPrice: number
): number {
  if (!ethPrice || !wchanPrice || secondsElapsed <= 0) return 0;
  const wethUsd =
    parseFloat(formatUnits(BigInt(wethDistributed || "0"), 18)) * ethPrice;
  const stakedUsd =
    parseFloat(formatUnits(BigInt(totalStaked || "0"), 18)) * wchanPrice;
  if (stakedUsd === 0) return 0;
  return (wethUsd / stakedUsd) * (31_536_000 / secondsElapsed) * 100;
}

export function VaultDataProvider({ children }: { children: ReactNode }) {
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ethPriceRef = useRef<number>(0);
  const { tokenData } = useTokenData();
  const wchanPrice = tokenData?.priceRaw ?? 0;

  const fetchEthPrice = useCallback(async () => {
    try {
      const res = await fetch(ETH_PRICE_URL);
      if (res.ok) {
        const data = await res.json();
        ethPriceRef.current = data.ethereum?.usd ?? 0;
      }
    } catch {
      // silent — keep previous price
    }
  }, []);

  const fetchVaultData = useCallback(async () => {
    if (!INDEXER_URL) {
      setIsLoading(false);
      return;
    }
    try {
      // Fetch ETH price if stale
      if (ethPriceRef.current === 0) {
        await fetchEthPrice();
      }

      const [apyRes, statsRes] = await Promise.all([
        fetch(`${INDEXER_URL}/apy?window=7d`),
        fetch(`${INDEXER_URL}/stats`),
      ]);

      if (!apyRes.ok || !statsRes.ok) throw new Error("Indexer fetch failed");

      const apyData = await apyRes.json();
      const statsData = await statsRes.json();

      const wchanApy: number = apyData.wchanAPY ?? 0;
      const wethApy = computeWethApy(
        apyData.wethDistributed,
        apyData.totalStaked,
        apyData.secondsElapsed,
        ethPriceRef.current,
        wchanPrice
      );
      const totalApy = wchanApy + wethApy;

      const totalStaked = statsData.totalStaked ?? apyData.totalStaked ?? "0";
      const stakedNum = parseFloat(formatUnits(BigInt(totalStaked), 18));
      const tvlUsd = stakedNum * wchanPrice;

      setVaultData({
        totalApy,
        wchanApy,
        wethApy,
        totalStaked,
        tvlUsd,
        sharePrice: statsData.currentSharePrice ?? apyData.sharePrice ?? "0",
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      retryTimeoutRef.current = setTimeout(() => {
        fetchVaultData();
      }, 3000);
    }
  }, [fetchEthPrice, wchanPrice]);

  // Re-fetch ETH price every polling interval
  useEffect(() => {
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEthPrice]);

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
    <VaultDataContext.Provider
      value={{ vaultData, isLoading, refetchVaultData: fetchVaultData }}
    >
      {children}
    </VaultDataContext.Provider>
  );
}

export function useVaultData() {
  return useContext(VaultDataContext);
}
