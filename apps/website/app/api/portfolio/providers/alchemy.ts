import { formatUnits } from "viem";
import { CHAIN_BY_ID, ChainSupport, PORTFOLIO_CHAINS } from "../chains";
import {
  PortfolioProvider,
  PortfolioToken,
  ProviderResult,
  formatBalance,
  normalizeContractAddress,
  NATIVE_SENTINEL,
} from "./types";

interface AlchemyTokenPrice {
  currency: string;
  value: string;
  lastUpdatedAt?: string;
}

interface AlchemyTokenMetadata {
  decimals?: number;
  logo?: string | null;
  name?: string;
  symbol?: string;
}

interface AlchemyToken {
  address: string;
  network: string;
  tokenAddress: string | null;
  tokenBalance: string;
  tokenMetadata?: AlchemyTokenMetadata;
  tokenPrices?: AlchemyTokenPrice[];
  error?: string | null;
}

interface AlchemyTokensResponse {
  data: {
    tokens: AlchemyToken[];
    pageKey?: string;
  };
}

const NETWORK_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  PORTFOLIO_CHAINS.filter((c) => c.alchemyNetwork).map((c) => [
    c.alchemyNetwork!,
    c.chainId,
  ])
);

export const alchemyProvider: PortfolioProvider = {
  name: "alchemy",

  isConfigured() {
    return !!process.env.ALCHEMY_API_KEY;
  },

  async fetch(address, chainIds, options): Promise<ProviderResult> {
    const apiKey = process.env.ALCHEMY_API_KEY!;
    const url = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`;

    const supported = chainIds
      .map((id) => CHAIN_BY_ID.get(id))
      .filter((c): c is ChainSupport => !!c && !!c.alchemyNetwork);
    const networks = supported.map((c) => c.alchemyNetwork!);

    const callAlchemy = async (nets: string[]) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: [{ address, networks: nets }],
          withMetadata: true,
          withPrices: true,
          includeNativeTokens: true,
          includeErc20Tokens: true,
        }),
        ...(options?.forceRefresh
          ? { cache: "no-store" as const }
          : { next: { revalidate: 60 } }),
      });
      if (!res.ok) throw new Error(`Alchemy ${res.status}`);
      return (await res.json()) as AlchemyTokensResponse;
    };

    let data: AlchemyTokensResponse;
    try {
      data = await callAlchemy(networks);
    } catch (err) {
      // Some chains (Unichain, Monad, MegaETH) are gated behind paid plans.
      // Retry with only free-tier chains so a missing entitlement doesn't
      // wipe out the whole portfolio response.
      const freeOnly = supported
        .filter((c) => !c.alchemyRequiresPaidPlan)
        .map((c) => c.alchemyNetwork!);
      if (freeOnly.length === networks.length) throw err;
      console.warn("[portfolio:alchemy] retry without paid-tier chains:", err);
      data = await callAlchemy(freeOnly);
    }

    const tokens: PortfolioToken[] = [];
    for (const t of data.data?.tokens || []) {
      const chainId = NETWORK_TO_CHAIN_ID[t.network];
      if (!chainId) continue;
      const meta = t.tokenMetadata;
      const contractAddress = normalizeContractAddress(t.tokenAddress);
      const nativeCurrency = contractAddress === NATIVE_SENTINEL
        ? CHAIN_BY_ID.get(chainId)?.nativeCurrency
        : undefined;
      const decimals = typeof meta?.decimals === "number" ? meta.decimals : (nativeCurrency?.decimals ?? 18);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255 ||
          typeof t.tokenBalance !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(t.tokenBalance)) {
        throw new Error("Alchemy returned an invalid token balance");
      }
      // Portfolio API balances are raw integer units (normally hex), not
      // decimal token amounts. parseFloat("0x…") silently discards every asset.
      const rawBalance = BigInt(t.tokenBalance);
      if (rawBalance === 0n) continue;
      const exactBalance = formatUnits(rawBalance, decimals);
      const balance = Number(exactBalance);
      if (!Number.isFinite(balance) || balance <= 0) throw new Error("Alchemy returned an invalid token balance");

      const priceUsd = parseFloat(t.tokenPrices?.find((price) => price.currency.toLowerCase() === "usd")?.value || "0");
      const valueUsd = balance * priceUsd;

      tokens.push({
        symbol: meta?.symbol || nativeCurrency?.symbol || "???",
        name: meta?.name || nativeCurrency?.name || meta?.symbol || "Unknown",
        contractAddress,
        chainId,
        decimals,
        balance: exactBalance,
        balanceFormatted: formatBalance(balance),
        priceUsd,
        valueUsd,
        logoUrl: meta?.logo || undefined,
      });
    }
    return { tokens, defiPositions: [] };
  },
};
