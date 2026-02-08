import fs from "fs/promises";
import path from "path";

// Chain IDs to fetch dapps for (from swiss-knife's walletChains)
const CHAIN_IDS = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 137, name: "Polygon" },
  { id: 130, name: "Unichain" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 56, name: "BSC" },
  { id: 43114, name: "Avalanche" },
  { id: 7777777, name: "Zora" },
  { id: 42220, name: "Celo" },
  { id: 100, name: "Gnosis" },
  { id: 57073, name: "Ink" },
  { id: 369, name: "PulseChain" },
  { id: 1868, name: "Soneium" },
  { id: 146, name: "Sonic" },
];

interface DappInfo {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
  chains: number[];
}

interface SafeApiResponse {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
  networks: number[];
}

// Disabled dapp IDs (don't work in iframes, deprecated, or Safe-internal)
const DISABLED_IDS = [
  // Updated chains in custom
  38, 88, 44, 20, 196, 87, 135, 122, 142,
  // Enzyme computed IDs
  parseInt(`51${42161}`), // Enzyme - Arbitrum
  parseInt(`51${8453}`),  // Enzyme - Base
  // Safe default apps
  29, 11,
  // Deprecated
  89,
  // Not supported in iframe
  129, 1, 186, 18, 75, 49, 61, 17, 67, 174, 66, 77, 128, 169, 109, 184,
  127, 71, 123, 171, 192, 141, 33, 43, 205, 207, 165, 28, 22, 12, 13, 162,
  2, 159, 23, 178, 14, 62, 8, 47, 57, 179, 52, 37, 76, 70, 83, 81, 65,
  156, 168, 72, 73, 98, 85, 31, 110, 108, 189, 130, 131, 121, 126, 176,
  132, 133, 119, 124, 125, 116, 48, 143, 182, 177, 144, 190, 149, 140,
  193, 146, 195, 198, 199, 209, 68, 150, 40, 161,
];

// Custom dapps with corrected chain support
const CUSTOM_DAPPS: DappInfo[] = [
  {
    id: 38,
    name: "Uniswap",
    description: "Swap or provide liquidity on the Uniswap Protocol",
    url: "https://app.uniswap.org",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/38/icon.png",
    chains: [1, 130, 8453, 42161, 137, 10, 56, 43114, 7777777, 42220],
  },
  {
    id: 88,
    name: "Revoke.cash",
    description: "Manage and revoke your token allowances with Revoke.cash",
    url: "https://revoke.cash/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/88/icon.png",
    chains: [1, 8453, 42161, 43114, 56, 100, 57073, 10, 137, 130, 7777777, 369, 1868, 146],
  },
  {
    id: 44,
    name: "Yearn",
    description: "The yield protocol for digital assets",
    url: "https://yearn.fi",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/44/icon.png",
    chains: [1, 42161, 8453, 137, 146],
  },
  {
    id: 20,
    name: "Curve Finance",
    description: "Decentralized exchange liquidity pool designed for extremely efficient stablecoin trading and low-risk income for liquidity providers",
    url: "https://www.curve.finance/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/b979c596-ffd7-43ca-b732-4057479dd282/icon.png",
    chains: [1, 8453, 42161, 43114, 56, 100, 57073, 10, 137, 146],
  },
  {
    id: 196,
    name: "sky.money",
    description: "Rewards, savings, upgrade, and trade",
    url: "https://app.sky.money/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/abf3c7f9-baa3-42bf-9782-d77433e22fc1/icon.png",
    chains: [1, 42161, 8453, 10, 130],
  },
  {
    id: 87,
    name: "Aura Finance",
    description: "Boosting DeFi yield potential and governance power",
    url: "https://app.aura.finance/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/87/icon.png",
    chains: [1, 42161, 43114, 8453, 100, 10, 137],
  },
  {
    id: 135,
    name: "Drips",
    description: "Stream & Split any ERC-20 on Ethereum",
    url: "https://www.drips.network/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/135/icon.png",
    chains: [1, 10],
  },
  {
    id: 51,
    name: "Enzyme Finance",
    description: "Onchain Asset Management",
    url: "https://app.enzyme.finance",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/51/icon.png",
    chains: [42161, 8453],
  },
  {
    id: 122,
    name: "dump.services",
    description: "Dump your tokens like a pro",
    url: "https://dump.services/",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/122/icon.png",
    chains: [1, 137],
  },
  {
    id: 142,
    name: "Pods Yield",
    description: "Earn more yield for your DAO treasury without risking the principal",
    url: "https://app.pods.finance",
    iconUrl: "https://safe-transaction-assets.safe.global/safe_apps/142/icon.png",
    chains: [1, 8453],
  },
  {
    id: 1753279954,
    name: "DefiLlama Swap",
    description: "LlamaSwap looks for the best route for your trade among a variety of Dex Aggregators, guaranteeing you the best execution prices in DeFi.",
    url: "https://swap.defillama.com/",
    iconUrl: "https://swap.defillama.com/_next/static/media/loader.268d236d.png",
    chains: [1, 8453, 42161, 43114, 56, 42220, 100, 10, 137, 146, 130],
  },
  {
    id: 1767000293,
    name: "Ethereum Follow Protocol",
    description: "The onchain social graph protocol for Ethereum accounts",
    url: "https://efp.app",
    iconUrl: "https://metadata.ens.domains/mainnet/avatar/efp.eth",
    chains: [1, 10, 8453],
  },
];

// Priority ordering for dapps
const DAPPS_PRIORITY = [
  38, 157, 44, 88, 20, 151, 155, 74, 93, 35, 91, 21, 196, 34, 25, 87, 46,
  135, 138, 173, 26, 54, 152, 160, 84, 51, 90, 36,
];

function transformDapp(dapp: SafeApiResponse, chainId: number): DappInfo {
  const chains = dapp.networks || [];
  if (!chains.includes(chainId)) {
    chains.push(chainId);
  }
  return {
    id: dapp.id,
    name: dapp.name,
    description: dapp.description,
    url: dapp.url,
    iconUrl: dapp.iconUrl,
    chains,
  };
}

async function fetchDappsForChain(chainId: number): Promise<DappInfo[]> {
  try {
    const response = await fetch(
      `https://safe-client.safe.global/v1/chains/${chainId}/safe-apps?clientUrl=https://app.safe.global`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://app.safe.global",
          Referer: "https://app.safe.global/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
      }
    );
    if (!response.ok) {
      console.error(`HTTP ${response.status} for chain ${chainId}`);
      return [];
    }
    const data: SafeApiResponse[] = await response.json();
    return data.map((dapp) => transformDapp(dapp, chainId));
  } catch (error) {
    console.error(`Error fetching dapps for chain ${chainId}:`, error);
    return [];
  }
}

async function main() {
  const uniqueDapps = new Map<number, DappInfo>();

  for (const chain of CHAIN_IDS) {
    console.log(`Fetching dapps for ${chain.name} (${chain.id})...`);
    const dapps = await fetchDappsForChain(chain.id);

    dapps.forEach((dapp) => {
      if (!uniqueDapps.has(dapp.id)) {
        uniqueDapps.set(dapp.id, { ...dapp, chains: dapp.chains || [] });
      } else {
        const existing = uniqueDapps.get(dapp.id)!;
        const mergedChains = Array.from(
          new Set([...(existing.chains || []), ...(dapp.chains || [])])
        );
        uniqueDapps.set(dapp.id, { ...existing, chains: mergedChains });
      }
    });
  }

  // Filter out disabled dapps
  const finalDapps = Array.from(uniqueDapps.values()).filter(
    (dapp) => !DISABLED_IDS.includes(dapp.id)
  );

  // Add custom dapps
  finalDapps.push(...CUSTOM_DAPPS);

  // Sort: priority dapps first, then the rest
  const sortedDapps = [
    ...DAPPS_PRIORITY
      .map((id) => finalDapps.find((dapp) => dapp.id === id))
      .filter((dapp): dapp is DappInfo => dapp !== undefined),
    ...finalDapps.filter((dapp) => !DAPPS_PRIORITY.includes(dapp.id)),
  ];

  // Write output (relative to this script's directory)
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const outputPath = path.join(scriptDir, "..", "app", "apps", "data", "dapps.json");
  await fs.writeFile(outputPath, JSON.stringify(sortedDapps, null, 2));

  console.log(`\n✅ Saved ${sortedDapps.length} dapps to ${outputPath}`);
}

main().catch(console.error);
