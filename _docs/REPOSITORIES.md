# Repository Ownership

The main repository contains the extension, website, docs site, domain reputation
service, and the RPC/MCP companion tools used to drive the wallet. Independent
apps have fresh repositories; their source history remains recoverable in the
main repository's Git history.

| Former app folder | Repository | Visibility |
| --- | --- | --- |
| `mascot` | [walletchan/mascot](https://github.com/walletchan/mascot) | Private |
| `ipfs-page-redirect` | [walletchan/ipfs-page-redirect](https://github.com/walletchan/ipfs-page-redirect) | Private |
| `ipfs-page-redirect-os` | [walletchan/ipfs-page-redirect-os](https://github.com/walletchan/ipfs-page-redirect-os) | Private |
| `contracts` | [walletchan/contracts](https://github.com/walletchan/contracts) | Public |
| `indexer` | [walletchan/bankr-launches-indexer](https://github.com/walletchan/bankr-launches-indexer) | Private |
| `drip-bot` | [walletchan/drip-bot](https://github.com/walletchan/drip-bot) | Private |
| `arb-bot` | [walletchan/arb-bot](https://github.com/walletchan/arb-bot) | Private |
| `tg-bot` | [walletchan/tg-bot](https://github.com/walletchan/tg-bot) | Private |
| `wchan-vault-indexer` | [walletchan/wchan-vault-indexer](https://github.com/walletchan/wchan-vault-indexer) | Private |
| `fee-indexer` | [walletchan/fee-indexer](https://github.com/walletchan/fee-indexer) | Private |
| `staking-indexer` | [walletchan/bnkrw-staking-indexer](https://github.com/walletchan/bnkrw-staking-indexer) | Private |

[walletchan/shared](https://github.com/walletchan/shared) is private and supplies
the extracted apps' shared packages. This repository retains `packages/shared`,
`packages/wchan-swap`, and `packages/contract-addresses` because the website and
extension still consume them. These local packages allow public builds without
access to private repos; shared-repo changes require intentional review and sync.

## Contract addresses and simulator source

The public [contracts repository](https://github.com/walletchan/contracts) owns
Solidity source, Foundry dependencies, deployment records, and the generated
public address package. Main retains its reviewed address snapshot. To update it
from a reviewed contracts checkout, run:

```sh
pnpm sync:addresses /path/to/contracts/addresses.json
```

Review the generated diff before committing; this is a manual development command
and never runs during extension, website, or docs builds. Solidity simulator
source and tests also live in contracts. The extension's embedded simulator
bytecode remains unchanged; follow [ASSET_CHANGES_SIMULATION.md](./ASSET_CHANGES_SIMULATION.md)
when deliberately rebuilding it.

## Hosting and remaining integrations

The fee indexer, WCHAN vault indexer, and drip bot now deploy from their individual
repos on `main`. Domain reputation still uses the monorepo deployment mirror.
See [RAILWAY.md](./RAILWAY.md). The website and docs Vercel projects use
`apoorvlathey/walletchan-vercel`, with roots `apps/website` and `apps/docs`.
No extracted app was linked to Vercel in the inspected account. The two GitHub
Actions workflows publish extension releases; neither builds extracted apps.
This cleanup PR does not merge, deploy, or push to the deployment mirror.

The website still consumes external vault/fee APIs. Vault metrics support the
website, extension staking views, admin statistics, and OS premium checks.
The Telegram and Bankr-launch services are retired, but website clients/pages
remain for a separate product decision; see [TOKEN_GATED_TG.md](./TOKEN_GATED_TG.md)
and [COINS.md](./COINS.md). Removing source folders does not remove product UI.
