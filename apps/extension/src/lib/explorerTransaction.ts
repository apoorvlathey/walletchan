import type { NetworksInfo } from "@/types";
import { getResolvedChains, type ResolvedChain } from "@/lib/chains";

export const EXPLORER_TRANSACTION_PATH_PATTERN =
  /(?:^|\/)tx\/(0x[0-9a-fA-F]{64})(?:\/|$)/;

export interface ExplorerTransactionPage {
  pageUrl: URL;
  txHash: `0x${string}`;
  chain: ResolvedChain;
}

export interface ExplorerRpcTransaction {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}` | null;
  input: `0x${string}`;
  value: `0x${string}`;
}

const EXPLORER_SITE_NAMES: Record<string, string> = {
  arbiscan: "Arbiscan",
  basescan: "BaseScan",
  bscscan: "BscScan",
  etherscan: "Etherscan",
  polygonscan: "PolygonScan",
};

export function getExplorerSiteName(value: string | URL): string {
  let hostname: string;
  try {
    hostname = (value instanceof URL ? value : new URL(value)).hostname;
  } catch {
    return "Explorer";
  }
  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".");
  const siteLabel =
    [...labels].reverse().find((label) => label.includes("scan")) ||
    labels.at(-2) ||
    labels[0];
  if (!siteLabel) return "Explorer";
  if (EXPLORER_SITE_NAMES[siteLabel]) return EXPLORER_SITE_NAMES[siteLabel];
  return siteLabel
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function explorerPathMatches(pageUrl: URL, explorerUrl: URL): boolean {
  if (pageUrl.origin !== explorerUrl.origin) return false;
  const basePath = explorerUrl.pathname.replace(/\/+$/, "");
  if (!basePath || basePath === "/") return true;
  return (
    pageUrl.pathname === basePath || pageUrl.pathname.startsWith(`${basePath}/`)
  );
}

export function extractExplorerTransactionHash(
  pathname: string,
): `0x${string}` | null {
  const match = pathname.match(EXPLORER_TRANSACTION_PATH_PATTERN);
  return match ? (match[1].toLowerCase() as `0x${string}`) : null;
}

export function resolveExplorerTransactionPage(
  value: unknown,
  networksInfo: NetworksInfo | undefined,
): ExplorerTransactionPage | null {
  const pageUrl = parseHttpUrl(value);
  if (!pageUrl) return null;
  const txHash = extractExplorerTransactionHash(pageUrl.pathname);
  if (!txHash) return null;

  const candidates = getResolvedChains(networksInfo)
    .map((chain) => ({ chain, explorerUrl: parseHttpUrl(chain.explorer) }))
    .filter(
      (candidate): candidate is { chain: ResolvedChain; explorerUrl: URL } =>
        candidate.explorerUrl !== null &&
        explorerPathMatches(pageUrl, candidate.explorerUrl),
    )
    .sort(
      (left, right) =>
        right.explorerUrl.pathname.length - left.explorerUrl.pathname.length,
    );

  const match = candidates[0];
  return match ? { pageUrl, txHash, chain: match.chain } : null;
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isHex(value: unknown): value is `0x${string}` {
  return (
    typeof value === "string" &&
    /^0x(?:[0-9a-fA-F]{2})*$/.test(value) &&
    value.length <= 2_000_002
  );
}

function isQuantity(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value);
}

export function parseExplorerRpcTransaction(
  value: unknown,
  expectedHash: string,
): ExplorerRpcTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const transaction = value as Record<string, unknown>;
  if (
    typeof transaction.hash !== "string" ||
    transaction.hash.toLowerCase() !== expectedHash.toLowerCase() ||
    !/^0x[0-9a-fA-F]{64}$/.test(transaction.hash) ||
    !isAddress(transaction.from) ||
    (transaction.to !== null && !isAddress(transaction.to))
  ) {
    return null;
  }
  const input = transaction.input ?? transaction.data;
  if (!isHex(input) || !isQuantity(transaction.value)) return null;

  return {
    hash: transaction.hash.toLowerCase() as `0x${string}`,
    from: transaction.from.toLowerCase() as `0x${string}`,
    to: transaction.to
      ? (transaction.to.toLowerCase() as `0x${string}`)
      : null,
    input: input.toLowerCase() as `0x${string}`,
    value: transaction.value.toLowerCase() as `0x${string}`,
  };
}
