# Railway Deployments

Deployment inventory verified on 2026-10-06; refresh before operational changes.

| Project | Source | Status |
| --- | --- | --- |
| `wchan-domain-reputation` | `apoorvlathey/walletchan-vercel`, `apps/domain-reputation` | Retained in the monorepo |
| `walletchan-fee-indexer` | `walletchan/fee-indexer`, `main` | Migrated and verified |
| `walletchan-wchan-vault-indexer` | `walletchan/wchan-vault-indexer`, `main` | Migrated and verified |
| `walletchan-drip-bot` | `walletchan/drip-bot`, `main` | Migrated and verified |
| `walletchan-staking-indexer` | Retired legacy sBNKRW service | Scheduled for deletion |
| `walletchan-tg-bot` | Retired Telegram service; deployment stopped | Scheduled for deletion |
| `walletchan-arb-bot` | Retired project | Scheduled for deletion |
| `walletchan-banker-coins-indexer` | Retired project | Scheduled for deletion |

The three migrated services retain their existing service identities, variables,
domains, and database bindings. Indexers use `/ready` as a Railway healthcheck.
The vault build fetches its pinned public contract-address package because
Railway does not populate the `contracts` Git submodule. The drip bot uses one
replica and zero deployment overlap; stop the old signing process before
starting a replacement to avoid concurrent transaction loops.

## Domain reputation

Use `apps/domain-reputation/Dockerfile` and its `railway.toml`; the Docker build
copies the workspace files and installs only `@walletchan/domain-reputation`.
Attach one volume at `/data`, set `DOMAIN_REPUTATION_SERVICE_TOKEN`, and put
the domain and same token in the website's `DOMAIN_REPUTATION_SERVICE_URL` /
`DOMAIN_REPUTATION_SERVICE_TOKEN` variables. `/readyz` is the deployment
healthcheck. The service loads its last-known-good snapshot from the volume
and polls the fixed MetaMask raw configuration URL with ETag validation.

Production variables are injected by Railway; do not copy `.env` files into
builds. Operational docs for independent services live in their repositories.
