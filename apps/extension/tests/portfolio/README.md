# Portfolio tests

This directory freezes the portfolio display-state boundary:

- `architecture.test.ts` enforces the single source folder, 400-line ceiling,
  pure-policy/effect separation, direct background composition, and snapshot
  refresh ordering.
- State, cache, chart, and token-key tests cover public display behavior.
- The browser navigation test remains explicit runtime QA and is excluded from
  the recursive security runner by basename.

`debtAccounting.test.ts` covers Zerion-to-server-to-extension debt direction, signed chain totals, legacy supply compatibility, malformed/oversized collections, negative cache round-trips and idempotent V3 invalidation. WCHAN and snapshot tests retain debt signs. Website `portfolioDebt.test.ts` covers loan/borrow classification, positive/negative provider magnitudes, rewards, chain separation, bounds and Octav debt-only positions.
