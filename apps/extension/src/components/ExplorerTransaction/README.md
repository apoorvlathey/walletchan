# Explorer Transaction UI

This domain owns the public, read-only transaction decoder shown by default as
an alternative to the native Input Data view on recognized block explorer
`/tx/<hash>` pages.

## Audit map

| File | Responsibility | Effects |
| --- | --- | --- |
| `ExplorerTransactionPanel.tsx` | Render decoded ERC-7821 inner calls through the shared batch summary without redundant calldata digests; otherwise lead with Action/verified-parameters/Payment and the expanded technical decoder | Decoded action state only; copy/address effects remain in shared children |
| `useExplorerTransaction.ts` | Resolve the source explorer, verify the configured RPC chain, and fetch one matching transaction | Sync-storage read and bounded RPC calls |

The page adapter in `pages/explorerTransaction.tsx` owns the iframe bootstrap,
theme/network providers, and resize messages. The content script owns DOM
placement, responsive half-width measure, and default iframe creation when the
synced `explorerEnhancementsEnabled` preference is not explicitly disabled. It
removes an existing embed immediately when that preference changes off. The
background explorer route exposes only
clear-signing and public token metadata to the exact embedded extension frame;
it grants no wallet-UI authority.
