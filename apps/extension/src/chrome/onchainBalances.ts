import {
  createPublicClient,
  http,
  formatUnits,
  erc20Abi,
  type Address,
} from "viem";
import { DEFAULT_NETWORKS } from "@/constants/networks";
import { PortfolioToken } from "@/chrome/portfolioApi";

/** Multicall3 is deployed at the same address on all supported chains */
const MULTICALL3_ADDRESS: Address =
  "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Map chainId → rpcUrl from DEFAULT_NETWORKS */
const chainRpcMap: Record<number, string> = {};
for (const net of Object.values(DEFAULT_NETWORKS)) {
  chainRpcMap[net.chainId] = net.rpcUrl;
}

/**
 * Fetch real on-chain balances for all tokens via multicall (ERC20) and
 * getBalance (native). Returns updated tokens with fresh balance fields.
 * If a chain fails, the original API balances are preserved for those tokens.
 */
export async function fetchOnchainBalances(
  address: string,
  tokens: PortfolioToken[]
): Promise<{ tokens: PortfolioToken[]; totalValueUsd: number }> {
  // Group tokens by chainId
  const byChain = new Map<number, { index: number; token: PortfolioToken }[]>();
  tokens.forEach((token, index) => {
    const group = byChain.get(token.chainId) || [];
    group.push({ index, token });
    byChain.set(token.chainId, group);
  });

  // Clone tokens so we can mutate
  const updated = tokens.map((t) => ({ ...t }));

  // Fetch balances per chain in parallel
  const chainPromises = Array.from(byChain.entries()).map(
    async ([chainId, entries]) => {
      const rpcUrl = chainRpcMap[chainId];
      if (!rpcUrl) return; // unknown chain, keep API values

      const client = createPublicClient({ transport: http(rpcUrl) });
      const addr = address as Address;

      const natives: typeof entries = [];
      const erc20s: typeof entries = [];

      for (const entry of entries) {
        if (
          entry.token.contractAddress === "native" ||
          entry.token.contractAddress ===
            "0x0000000000000000000000000000000000000000"
        ) {
          natives.push(entry);
        } else {
          erc20s.push(entry);
        }
      }

      // Fetch native balances
      const nativePromises = natives.map(async (entry) => {
        try {
          const bal = await client.getBalance({ address: addr });
          applyBalance(updated, entry.index, bal, entry.token);
        } catch (err) {
          console.warn(`[onchain] native balance fetch failed (chain ${chainId}):`, err);
        }
      });

      // Fetch ERC20 balances via multicall
      let erc20Promise = Promise.resolve();
      if (erc20s.length > 0) {
        erc20Promise = (async () => {
          try {
            const contracts = erc20s.map((entry) => ({
              address: entry.token.contractAddress as Address,
              abi: erc20Abi,
              functionName: "balanceOf" as const,
              args: [addr] as const,
            }));

            const results = await client.multicall({
              contracts,
              multicallAddress: MULTICALL3_ADDRESS,
            });

            results.forEach((result, i) => {
              if (result.status === "success") {
                applyBalance(
                  updated,
                  erc20s[i].index,
                  result.result as bigint,
                  erc20s[i].token
                );
              }
              // on failure, keep API value for that token
            });
          } catch (err) {
            console.warn(`[onchain] multicall failed (chain ${chainId}):`, err);
          }
        })();
      }

      await Promise.all([...nativePromises, erc20Promise]);
    }
  );

  await Promise.all(chainPromises);

  // Recompute totalValueUsd
  const totalValueUsd = updated.reduce((sum, t) => sum + t.valueUsd, 0);

  return { tokens: updated, totalValueUsd };
}

/** Apply a raw bigint balance to a token entry, recomputing derived fields */
function applyBalance(
  tokens: PortfolioToken[],
  index: number,
  rawBalance: bigint,
  originalToken: PortfolioToken
) {
  const balanceStr = formatUnits(rawBalance, originalToken.decimals);
  const balanceNum = parseFloat(balanceStr);

  tokens[index].balance = balanceStr;
  tokens[index].balanceFormatted = formatBalance(balanceNum);
  tokens[index].valueUsd = balanceNum * originalToken.priceUsd;
}

/** Format a numeric balance to a human-readable string (max 6 significant digits) */
function formatBalance(value: number): string {
  if (value === 0) return "0";
  if (value < 0.000001) return "<0.000001";
  if (value >= 1_000_000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  // Show up to 6 significant digits
  return parseFloat(value.toPrecision(6)).toString();
}
