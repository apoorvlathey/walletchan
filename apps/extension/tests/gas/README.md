# Gas estimation tests

- `architecture.test.ts` freezes all three compatibility-facade identities,
  one-way dependencies, and per-module audit budgets.
- `policy.test.ts` freezes EIP-7702 gas overhead, fee-history percentiles and
  next-base prediction, standard-tier compatibility, and legacy gas-price
  fallback semantics.
- `fallbacks.test.ts` freezes batch tier order, 2x sequential-simulation
  buffers, the 500k dependent-call fallback, single-estimate failure values,
  and per-call cost/balance construction.

Transport routing remains covered by `../background/gasSimulationRouter.test.ts`;
transaction legacy-fee conversion remains covered in `../transactions/`.

- `ethereumFees.test.ts` covers the 0.0001 gwei Ethereum floor, demand-driven
  higher tips, malformed/missing/zero RPC fallbacks, unchanged other-chain
  floors, small-value formatting, and replacement minimums.
- `ethereumBroadcast.test.ts` is opt-in local Anvil coverage. It signs fixture
  PK/seed transactions, broadcasts through the production raw-RPC boundary,
  and checks receipts for all tiers and pending replacements. Run from the
  extension directory with `WALLETCHAN_TEST_ANVIL=1 pnpm exec tsx --test
  tests/gas/*.test.ts`. Anvil must be on PATH; no public transaction is sent.

See `_docs/GAS_FEE_VALIDATION.md` at the repository root for validation scope
and the outstanding real-device/mainnet checks.
