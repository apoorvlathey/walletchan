# v4.1.0 upgrade compatibility

Baseline: release tag `v4.1.0` (`2dda76fd6485d56bc23a8089c13e72e6a6c6bd88`).
The comparison is against the candidate working tree, including the firm-quote
swap review and release-validation fixes. This is a storage/recovery acceptance
record, not a store-publication approval or a guarantee for every possible profile.

## Storage review

- General/private-key vault encryption, password and passkey record formats,
  session restoration, history database/schema, legacy account migration, and
  install/update composition are unchanged from the release tag.
- `seedGroups[*].backupPending` is optional and written for new onboarding
  generation. Existing seed groups without the field remain valid and are not
  retroactively assigned a backup reminder.
- Safe `executionAt` is optional display metadata. Released proposals without it
  remain decodable and retain the existing transaction-hash/signature meaning.
- `portfolioHoldingsCache` advances from V3 to V4. The old disposable display
  cache is intentionally removed and refetched because it cannot represent debt
  accurately. Historical `portfolioSnapshotsV2` and transaction history are not
  that cache and are not deleted by this change.
- New signed net-value snapshots are additive. Older non-negative snapshots
  remain valid; historical totals are not retroactively recomputed.
- New account capability policy and Ledger force-inclusion dispatch do not
  rewrite account IDs, account types, derivation paths, or private keys.
- Network normalization preserves valid user RPC/explorer overrides, hidden
  flags, and custom networks. Redundant default explorer values can normalize
  away without changing the effective explorer.
- Pending request storage remains compatible. Added Safe signature review is
  reject-only and does not grant Safe records direct signing authority.
- Privacy Pools ASP verification changes do not change encrypted vault,
  commitment, operation, withdrawal, or public-exit database formats. Existing
  recovery tests cover persisted operations and phrase-derived note recovery.

No new destructive migration or custody-format migration was required by this
review. Existing security checks remain enforced rather than guessing missing
request authority or accepting corrupt encrypted records.

## Browser acceptance method

`pnpm --filter @walletchan/extension qa:extension:upgrade` takes
`EXTENSION_QA_BASELINE_BUILD`, a Chrome build of the released tag. It creates its
own temporary extension copy and Chromium profile. The test invokes the released
background handlers to create the encrypted general vault, private key, a seed
group with two derived accounts, Bankr credential, agent factor, and Privacy
Pools recovery identity. Public Ledger/Safe/view-only metadata, preferences,
contacts, hidden tokens, and chat state complete the representative profile.
The released history migration materializes a transaction and ERC-20 transfer
in the real IndexedDB database before the candidate is loaded.

Chromium's browser-level `Extensions.loadUnpacked` loads the candidate into the
same profile/path/extension origin. A test-only version and passive lifecycle
observer in the temporary copy verify `onInstalled(reason: update)` with
`previousVersion: 4.1.0`. A second browser launch/update hook exercises repeat
behavior. Repository manifests are not bumped by this check.

The matrix uses both 15-minute and explicit Never auto-lock settings. It checks:

- Existing wallet is recognized without entering fresh onboarding.
- Ciphertext and account/group metadata remain unchanged before and after use.
- Selected account, theme, custom RPC/explorer, custom chain, hidden-network,
  slippage, gas-tier, privacy-display, and sidepanel preferences survive.
- Transaction and transfer history remain readable from IndexedDB.
- A pre-update pending signature request survives, returns after unlock, and
  can be rejected through the current UI.
- Wrong-password unlock fails; master and agent unlock still succeed.
- Private-key and both derived seed accounts produce locally recovered
  signatures under both master and agent sessions.
- Master-authorized key/phrase recovery returns the original synthetic secrets;
  the agent factor remains unable to reveal them.
- The existing Privacy Pools identity opens with the original recovery key.

All remote traffic is blocked apart from a locally fulfilled synthetic Bankr
ownership challenge. No transaction is submitted. All profiles are disposed in
`finally`; the user's browser, passwords, keys, and real wallet data are unused.

## Validation result — 2026-10-09

- Both Chromium profile cases passed their first upgrade and repeat restart/update
  cycle: four successful cycles, including the pending-request UI check.
- 138 focused compatibility tests passed: 107 vault/passkey/account/onboarding/
  history/privacy tests, 14 portfolio-cache/network tests, and 17 Safe/Privacy
  Pools lifecycle tests. No failures or skips in these focused runs.
- QA TypeScript validation and `git diff --check` passed.
- This work added the upgrade runner and safer release instructions; it did not
  require a new production storage migration or alter the extension version.

## Other evidence and limits

The focused upgrade suites cover frozen password-encrypted PK/mnemonic records,
V1/V2 passkey wrappers, legacy API migration, native-session fallback cleanup,
onboarding recovery, history, old portfolio-cache invalidation, Safe proposal
compatibility, and Privacy Pools recovery/lifecycle behavior. QA TypeScript checks
also cover the reusable browser runner.

Ledger/Bankr live operation is separately user-confirmed. Hardware signing,
actual WebAuthn ceremonies, and live Safe execution are not reproduced by this
upgrade runner. Frozen passkey fixtures verify record/key compatibility, not a
physical authenticator ceremony. Synthetic profiles cannot represent all corrupt
or interrupted historical customer states. Keep this distinction when reporting
release readiness.
