# Indexer Integrations

This workspace contains API clients for external indexing services. Backend
implementation and deployment configuration are outside its scope.

The website uses vault data for sWCHAN balances, APY, and snapshots, and fee data
for fee claims and cumulative totals. The extension accesses vault metrics
through the website's `/api/vault-data`.

Keep endpoint configuration and response handling in sync with these clients.
The launch-indexing service is retired; the remaining coins UI and client are
documented in [COINS.md](./COINS.md). The website also retains its `/verify`
page; vault balance lookup is available, but verification cannot complete while
the bot API is retired.
