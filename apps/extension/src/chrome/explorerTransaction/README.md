# Explorer Transaction Domain

This domain owns the opt-in transaction decoder embedded in the native Input
Data section of configured block-explorer transaction pages.

- `injection.ts` recognizes top-frame `/tx/<hash>` pages, inserts an isolated
  Explorer/WalletChan tab selector into the native Input Data value column,
  lazily mounts the extension iframe only after WalletChan is selected, and
  relays bounded resize/dismiss events.
- `messageRouter.ts` authorizes only the exact `explorer.html` extension
  document embedded in a tab whose Chrome-attested URL matches the configured
  explorer and chain. It exposes public descriptor/token metadata only.

The explorer page is never classified as trusted wallet UI and receives no
account, secret, session, signing, history, or transaction-submission access.
