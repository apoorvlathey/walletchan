# Indexer Integrations

Ponder indexers are maintained in separate private repositories:

- [WCHAN vault indexer](https://github.com/walletchan/wchan-vault-indexer): sWCHAN balances, APY, and vault snapshots.
- [Fee indexer](https://github.com/walletchan/fee-indexer): fee claims and cumulative totals.
- [Bankr launches indexer](https://github.com/walletchan/bankr-launches-indexer): coin launches; Railway project retired.
- [BNKRW staking indexer](https://github.com/walletchan/bnkrw-staking-indexer): legacy sBNKRW; Railway project retired.

Implementation and RPC-filtering conventions live in each repository's docs.
The website retains its API clients and configured URLs. The extension accesses
vault metrics through the website's `/api/vault-data`. See
[REPOSITORIES.md](./REPOSITORIES.md) and [RAILWAY.md](./RAILWAY.md).
