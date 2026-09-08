# Explorer Transaction Domain

This domain owns the transaction decoder (enabled by default) embedded in the native Input
Data section of configured block-explorer transaction pages.

- `injection.ts` recognizes top-frame `/tx/<hash>` pages, inserts an isolated
  Explorer/WalletChan tab selector into the native Input Data value column,
  selects WalletChan by default and mounts its extension iframe, and relays
  bounded resize/dismiss events. The synced explorer-enhancements preference
  disables injection and removes existing views when set to false.
- `messageRouter.ts` authorizes only the exact `explorer.html` extension
  document embedded in a tab whose Chrome-attested URL matches the configured
  explorer and chain. It exposes public descriptor/token metadata only.

The explorer page is never classified as trusted wallet UI and receives no
account, secret, session, signing, history, or transaction-submission access.
