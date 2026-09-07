# Ethereum priority-fee reduction — 2026-09-07

## Scope and policy

Ethereum mainnet's evidence-backed priority floor changes from 0.05 to
0.0001 gwei (100,000 wei), following Ambire's small positive-floor approach.
This is not a fixed recommended fee or an inclusion guarantee. WalletChan
continues using the configured RPC's last ten block-median rewards, dropping
zeros and filtering outliers, then selecting p25/p60/p90 across those blocks.
The existing 12% tier spacing is preserved. Minimum Slow/Normal/Fast tips are
0.0001/0.000112/0.00012544 gwei, only when observed demand is sufficiently low.

The base-fee predictor, 1.25x/1.5x/2x base-fee caps, gas-limit buffers, explicit
dapp/custom fees, and replacement bump checks are unchanged. Missing or invalid
history tries `eth_maxPriorityFeePerGas`. Without a positive valid suggestion,
Ethereum retains its prior conservative 0.05 gwei fallback. Legacy gas-price
fallback and other-chain floors are unchanged. Fee responses are bounded hex
quantities; malformed rewards cannot escape the fallback through BigInt errors.
No fee-service API, account payload, dependency, or new network destination is
introduced.

Bankr native submission still chooses fees remotely. Token-paid UserOperations
still use the existing bundler quote. These are separate from the changed
local native-gas estimate. Safe native execution uses the shared estimator;
linked-owner approval/execution authority is unchanged.

## Automated evidence

The targeted run passed 88 tests; two additional fallback/surge tests also
passed (90 distinct checks total). Extension TypeScript checking and the full
`pnpm build:extension` succeeded, including bundle-budget and license packaging
checks. The rebuilt background contains the new floor. Coverage includes:

- Quiet and busy markets, bad/missing/zero history and RPC tips, legacy fallback,
  other chains, decimal display precision, and replacement floors.
- Private-key and seed confirmation/execution, Bankr confirmation and submission,
  Ledger no-device lifecycle, Safe execution, view-only execution boundaries,
  UserOperation serialization, and replacement preparation/policy.
- Local Anvil acceptance/mining: each low-fee tier, using PK and seed-derived
  fixture identities; replacements are accepted before mining and only the
  replacement receives a receipt. Uses real signed EIP-1559 bytes and the
  production `broadcastSerializedTransaction` boundary. This is not real-device
  signing or a mainnet propagation test.

Run from `apps/extension`:

```sh
WALLETCHAN_TEST_ANVIL=1 pnpm exec tsx --test tests/gas/*.test.ts tests/transactions/localConfirmation.test.ts tests/transactions/localExecution.test.ts tests/transactions/bankrConfirmation.test.ts tests/transactions/replacement*.test.ts tests/ledger/signingLifecycle.test.ts tests/bankr/bankrApiSecurity.test.ts tests/feePayment/userOperation.test.ts tests/transactions/impersonatedExecution.test.ts tests/safe/execution*.test.ts
```

## Historical replay

Read-only `eth_feeHistory` data obtained from dRPC, with the latest 1,024-block
sample cross-checked against PublicNode and 1RPC. Blocks 25,917,666–25,924,833
span September 6 10:20:11 through September 7 10:18:23 UTC.

Replay evaluated 7,158 rolling ten-block windows using the production estimator.
Compared with the old floors on the same observations, Normal's tip was lower
in 5,082 windows (71.0%). Among those reductions, the average tip reduction was
54.2%; this is not the reduction in total transaction cost. The median new
Normal tip across windows was 0.035 gwei, demonstrating that the floor does not
force every estimate down to 0.000112 gwei.

All 7,158 Normal caps covered the next observed block's base fee plus their full
suggested tip. 7,029 suggestions (98.2%) met or exceeded that next block's
10th-percentile effective tip. This is a historical comparison, not an inclusion
rate: it does not model mempool admission, propagation, competing demand,
transaction complexity, private builder arrangements, or the user's review delay.
The replay reconstructed gasUsed from the recorded ratio and a 60m gas limit.
Raw research data and replay script were temporary local research artifacts,
not runtime dependencies or checked-in fixtures.

## Release QA still required

The user subsequently tested successful Ethereum mainnet swaps with Fast and
Normal. Onchain fee caps exactly matched the corresponding estimates replayed
from preceding blocks. Both tips were above the former floor, so these confirm
preset propagation and successful submission, not mainnet inclusion at the new
minimum. Account type and auth factor were not established; real Ledger QA
remains unconfirmed. No public transaction was submitted by the automated tests.
Before treating the change as fully release-validated:

1. Reload the rebuilt extension. Review a small Ethereum send with each PK,
   seed, and Ledger account, checking the reviewed tip against the actual
   transaction and receipt; exercise master and agent sessions independently.
2. On a real Ledger, approve a low-fee send and verify its receipt; test device
   rejection without any submission. Automated mocks cannot replace this.
3. Verify a reviewed speed-up preserves the original nonce and satisfies the
   original fee bump, including an old transaction made with the former floor.
4. Check Bankr's native server-managed flow and Safe native execution through an
   eligible owner separately. Check token-paid quotes separately if used.

No static fee policy can guarantee inclusion or acceptance at every custom RPC.
Operators can impose their own minimum tip, and congestion can change after
review. Preserve these limitations when reporting the change.
