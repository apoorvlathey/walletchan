/**
 * Syncs contract addresses from apps/contracts/addresses.json into
 * packages/contract-addresses/src/addresses.ts (single source of truth).
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
const OUTPUT = resolve(
  __dirname,
  "../../../packages/contract-addresses/src/addresses.ts",
);

const ZERO = "0x0000000000000000000000000000000000000000";

// ─── swap addresses ───

const SWAP_KEY_MAP: Record<string, string> = {
  WCHAN: "wchan",
  WCHAN_DEV_FEE_HOOK: "hook",
  WETH: "weth",
  UNIVERSAL_ROUTER: "universalRouter",
  POOL_MANAGER: "poolManager",
  OLD_TOKEN: "oldToken",
  WCHAN_WRAP_HOOK: "wrapHook",
};

const SWAP_EXTRA: Record<string, Record<string, string>> = {
  "11155111": {
    quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    oldTokenPoolHook: "0x0000000000000000000000000000000000000000",
  },
  "8453": {
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    oldTokenPoolHook: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC",
  },
};

const SWAP_CHAINS = ["11155111", "8453"];
const LIVE_CHAINS = ["8453", "11155111"];

const CHAIN_COMMENTS: Record<string, string> = {
  "11155111": "ETH Sepolia",
  "8453": "Base mainnet",
};

// ─── drip addresses ───

const DRIP_KEY_MAP: Record<string, string> = {
  WCHAN: "wchan",
  WETH: "weth",
  WCHAN_VAULT: "wchanVault",
  DRIP_WCHAN_REWARDS: "dripWchanRewards",
};

const DRIP_CHAINS = ["11155111", "8453"];
const DEFAULT_DRIP_CHAIN = "11155111";

// ─── generate ───

function main() {
  const raw = readFileSync(CONTRACTS_ADDRESSES, "utf-8");
  const contracts: Record<string, Record<string, unknown>> = JSON.parse(raw);

  const swapSection = generateSwapSection(contracts);
  const dripSection = generateDripSection(contracts);

  const liveCheck = LIVE_CHAINS.map((c) => `chainId === ${c}`).join(" || ");

  const output = `// AUTO-GENERATED — do not edit manually.
// Run \`pnpm sync:addresses\` to regenerate from apps/contracts/addresses.json

import type { Address } from "viem";

// ─── Swap Addresses ───

export interface SwapChainAddresses {
  wchan: Address;
  hook: Address;
  weth: Address;
  universalRouter: Address;
  quoter: Address;
  permit2: Address;
  poolManager: Address;
  oldToken: Address;
  wrapHook: Address;
  oldTokenPoolHook: Address;
}

export const SWAP_ADDRESSES: Record<number, SwapChainAddresses> = {
${swapSection}
};

export type SupportedSwapChainId = keyof typeof SWAP_ADDRESSES;

export function getSwapAddresses(chainId: number): SwapChainAddresses {
  const addrs = SWAP_ADDRESSES[chainId];
  if (!addrs) throw new Error(\`Unsupported swap chain: \${chainId}\`);
  return addrs;
}

export function isChainLive(chainId: number): boolean {
  return ${liveCheck};
}

// ─── Drip Addresses ───

export interface DripChainAddresses {
  wchan: Address;
  weth: Address;
  wchanVault: Address;
  dripWchanRewards: Address;
}

export const DRIP_ADDRESSES: Record<number, DripChainAddresses> = {
${dripSection}
};

export const SUPPORTED_DRIP_CHAIN_IDS = Object.keys(DRIP_ADDRESSES).map(Number);
export const DEFAULT_DRIP_CHAIN_ID = ${DEFAULT_DRIP_CHAIN};
`;

  writeFileSync(OUTPUT, output);
  console.log(`Synced all contract addresses to ${OUTPUT}`);
}

function generateSwapSection(
  contracts: Record<string, Record<string, unknown>>,
): string {
  const chainEntries: string[] = [];

  for (const chainId of SWAP_CHAINS) {
    const src = contracts[chainId] ?? {};
    const extra = SWAP_EXTRA[chainId] ?? {};

    const fields: Record<string, string> = {};
    for (const [jsonKey, tsField] of Object.entries(SWAP_KEY_MAP)) {
      const val = src[jsonKey];
      fields[tsField] = typeof val === "string" ? val : ZERO;
    }
    Object.assign(fields, extra);

    const comment = CHAIN_COMMENTS[chainId]
      ? `  // ${CHAIN_COMMENTS[chainId]}\n`
      : "";
    const fieldLines = Object.entries(fields)
      .map(([k, v]) => `    ${k}: "${v}",`)
      .join("\n");

    chainEntries.push(`${comment}  ${chainId}: {\n${fieldLines}\n  },`);
  }

  return chainEntries.join("\n");
}

function generateDripSection(
  contracts: Record<string, Record<string, unknown>>,
): string {
  const chainEntries: string[] = [];

  for (const chainId of DRIP_CHAINS) {
    const src = contracts[chainId] ?? {};

    const fields: Record<string, string> = {};
    for (const [jsonKey, tsField] of Object.entries(DRIP_KEY_MAP)) {
      const val = src[jsonKey];
      fields[tsField] = typeof val === "string" ? val : ZERO;
    }

    const comment = CHAIN_COMMENTS[chainId]
      ? `  // ${CHAIN_COMMENTS[chainId]}\n`
      : "";
    const fieldLines = Object.entries(fields)
      .map(([k, v]) => `    ${k}: "${v}",`)
      .join("\n");

    chainEntries.push(`${comment}  ${chainId}: {\n${fieldLines}\n  },`);
  }

  return chainEntries.join("\n");
}

main();
