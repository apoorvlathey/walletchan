/**
 * Syncs contract addresses from apps/contracts/addresses.json
 * into apps/website/lib/wchan-swap/addresses.ts
 *
 * Usage: pnpm sync:addresses
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_ADDRESSES = resolve(
  __dirname,
  "../../contracts/addresses.json",
);
const OUTPUT_FILE = resolve(__dirname, "../lib/wchan-swap/addresses.ts");

// Mapping: addresses.json key → ChainAddresses field
const KEY_MAP: Record<string, string> = {
  WCHAN: "wchan",
  WCHAN_DEV_FEE_HOOK: "hook",
  WETH: "weth",
  UNIVERSAL_ROUTER: "universalRouter",
  POOL_MANAGER: "poolManager",
};

// Addresses not in contracts/addresses.json — preserved per chain
const EXTRA_ADDRESSES: Record<string, Record<string, string>> = {
  "11155111": {
    quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
  "8453": {
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
};

const ZERO = "0x0000000000000000000000000000000000000000";

// Chains to include in the output (only those relevant to wchan-swap)
const SUPPORTED_CHAINS = ["11155111", "8453"];

const CHAIN_COMMENTS: Record<string, string> = {
  "11155111": "ETH Sepolia",
  "8453": "Base mainnet",
};

// Chains where swap is live
const LIVE_CHAINS = ["8453", "11155111"];

function main() {
  const raw = readFileSync(CONTRACTS_ADDRESSES, "utf-8");
  const contracts: Record<string, Record<string, unknown>> = JSON.parse(raw);

  const chainEntries: string[] = [];

  for (const chainId of SUPPORTED_CHAINS) {
    const src = contracts[chainId] ?? {};
    const extra = EXTRA_ADDRESSES[chainId] ?? {};

    const fields: Record<string, string> = {};
    for (const [jsonKey, tsField] of Object.entries(KEY_MAP)) {
      const val = src[jsonKey];
      fields[tsField] = typeof val === "string" ? val : ZERO;
    }
    // Merge extras (quoter, permit2)
    Object.assign(fields, extra);

    const comment = CHAIN_COMMENTS[chainId]
      ? `  // ${CHAIN_COMMENTS[chainId]}\n`
      : "";
    const fieldLines = Object.entries(fields)
      .map(([k, v]) => `    ${k}: "${v}",`)
      .join("\n");

    chainEntries.push(`${comment}  ${chainId}: {\n${fieldLines}\n  },`);
  }

  const liveCheck = LIVE_CHAINS.map((c) => `chainId === ${c}`).join(" || ");

  const output = `// AUTO-GENERATED — do not edit manually.
// Run \`pnpm sync:addresses\` to regenerate from apps/contracts/addresses.json

import type { Address } from "viem";

interface ChainAddresses {
  wchan: Address;
  hook: Address;
  weth: Address;
  universalRouter: Address;
  quoter: Address;
  permit2: Address;
  poolManager: Address;
}

export const ADDRESSES: Record<number, ChainAddresses> = {
${chainEntries.join("\n")}
};

export type SupportedChainId = keyof typeof ADDRESSES;

export function getAddresses(chainId: number): ChainAddresses {
  const addrs = ADDRESSES[chainId];
  if (!addrs) throw new Error(\`Unsupported chain: \${chainId}\`);
  return addrs;
}

export function isChainLive(chainId: number): boolean {
  return ${liveCheck};
}
`;

  writeFileSync(OUTPUT_FILE, output);
  console.log(`Synced addresses to ${OUTPUT_FILE}`);
}

main();
