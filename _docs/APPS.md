# Apps Page

The `/apps` page lets users browse and interact with dApps in an iframe via WalletChan.

## Data Source

Dapp data comes from the [Safe Global registry API](https://safe-client.safe.global), fetched and processed by `apps/website/scripts/fetchSafeDapps.ts`. This is the same approach used by [swiss-knife](https://github.com/apoorvlathey/swiss-knife).

### Refreshing Dapp Data

```bash
cd apps/website
pnpm fetch-dapps
```

This regenerates `app/apps/data/dapps.json` (~62 dapps). The JSON is committed to the repo so builds work without running the script.

### How the Fetch Script Works

1. Fetches dapps from Safe API for all 15 supported chains
2. Merges chain lists for dapps that appear on multiple chains
3. Filters out disabled dapps (broken in iframes, deprecated, Safe-internal)
4. Adds custom dapps with corrected chain support (Uniswap, Revoke.cash, Yearn, Curve, sky.money, Aura, Drips, Enzyme, dump.services, Pods Yield, DefiLlama Swap, EFP)
5. Applies priority sorting (popular dapps first)

## Supported Chains

| Chain      | ID      | RPC                                     |
| ---------- | ------- | --------------------------------------- |
| Ethereum   | 1       | `https://eth.llamarpc.com`              |
| Base       | 8453    | `https://base.llamarpc.com`             |
| Polygon    | 137     | `https://polygon.llamarpc.com`          |
| Unichain   | 130     | `https://mainnet.unichain.org`          |
| Arbitrum   | 42161   | `https://arb1.arbitrum.io/rpc`          |
| Optimism   | 10      | `https://mainnet.optimism.io`           |
| BSC        | 56      | `https://bsc-dataseed.binance.org`      |
| Avalanche  | 43114   | `https://api.avax.network/ext/bc/C/rpc` |
| Zora       | 7777777 | `https://rpc.zora.energy`               |
| Celo       | 42220   | `https://forno.celo.org`                |
| Gnosis     | 100     | `https://rpc.gnosischain.com`           |
| Ink        | 57073   | `https://rpc-gel.inkonchain.com`        |
| PulseChain | 369     | `https://rpc.pulsechain.com`            |
| Soneium    | 1868    | `https://rpc.soneium.org`               |
| Sonic      | 146     | `https://rpc.soniclabs.com`             |

Chain filters on the page are derived dynamically from the dapp data.

## Key Files

| File                                             | Purpose                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `apps/website/scripts/fetchSafeDapps.ts`         | Fetch script — pulls from Safe API, filters, adds custom dapps                |
| `apps/website/app/apps/data/dapps.json`          | Generated dapp data (committed)                                               |
| `apps/website/app/apps/data/dapps.ts`            | TypeScript exports: `DAPPS`, `DappEntry`, `CHAIN_NAMES`                       |
| `apps/website/app/wagmiConfig.ts`                | Wagmi config — chains, RainbowKit connectors, `CHAIN_RPC_URLS` map            |
| `apps/website/app/apps/page.tsx`                 | Apps page — search, chain filters, grid, ConnectButton, IframeApp integration |
| `apps/website/app/apps/components/IframeApp.tsx` | Iframe wrapper — wagmi hooks, chain selector, tx forwarding via walletClient  |
| `apps/website/app/apps/components/AppCard.tsx`   | Dapp card component — icon, name, description, chain badges                   |

## Adding a New Chain

1. Add the chain to `CHAIN_IDS` in `scripts/fetchSafeDapps.ts`
2. Add the chain to `CHAIN_NAMES` in `app/apps/data/dapps.ts`
3. Add the chain import to `walletChains` in `app/wagmiConfig.ts`
4. Add the chain's RPC URL to `CHAIN_RPC_URLS` in `app/wagmiConfig.ts`
5. Run `pnpm fetch-dapps` to regenerate data

## Adding a Custom Dapp

Add an entry to `CUSTOM_DAPPS` in `scripts/fetchSafeDapps.ts`, then run `pnpm fetch-dapps`. Custom dapps override the Safe registry version (the original is disabled by ID).

## Disabling a Dapp

Add its Safe API ID to `DISABLED_IDS` in `scripts/fetchSafeDapps.ts`, then run `pnpm fetch-dapps`.
