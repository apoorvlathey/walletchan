# Bunker Mode

A client-side address/name checker at `/bunker-mode`. No wallet connection or
signature is requested. Checks run concurrently across built-in WalletChan mainnets.

`chains.json` is a generated public metadata snapshot of
`apps/extension/src/constants/chainRegistry.ts` in this repository. It excludes
native testnets and includes all mainnets, including those hidden by default in the
wallet. Refresh after registry changes:

```sh
node apps/website/scripts/sync-bunker-chains.mjs
node apps/website/scripts/sync-bunker-chains.mjs --check
pnpm --filter @walletchan/website exec tsx --test tests/bunkerMode.test.ts
```

Each network batches chain ID, confirmed nonce (`latest`) and account code.
Batch-incompatible endpoints use parallel individual requests. Ethereum has two
additional public fallback endpoints for checks and name resolution. Requests
have bounded timeouts and cancellation; retry rechecks all networks so a newly dated card never reuses stale zeros.

A positive EOA nonce or EIP-7702 delegation produces the activity verdict. Contract
code is classified separately because a contract nonce says nothing about owner
keys. Only complete zero-nonce, empty-code coverage yields the clean verdict.
Complete coverage with contract code and no activity yields the contract
verdict: contract accounts have no private key of their own. Any unanswered
network makes the result incomplete. No result is a security guarantee. Pending
transactions, offchain signatures, other chains and testnets are outside coverage.

ENS names are normalized; .wei/.gwei resolution uses the same deployed contracts
as the wallet. Try the selected name's avatar first, then other verified names
for the address in `.gwei`, `.wei`, ENS order. Unsupported or missing avatar text
records fall through to the next service without changing the display name.
Unavailable or non-CORS avatars fall back to the same `blo` blockie used in the
extension. Named cards show a shortened address below the name; unnamed cards
show only their shortened address. Name/avatar
failures never invent activity or override chain-check failures.
Raw addresses select reverse names in `.gwei`, `.wei`, then ENS order, verifying
that the selected name resolves back to the same address. Name display survives
unavailable avatars. Names entered directly retain their supplied identity.

`card.ts` creates a 1200x630 PNG locally, used for both preview and download.
Cards reuse
approved unlock-mascot layers, with a happy wink for clean/contract coverage,
a generated spiral-eye neutral mascot for activity, and a neutral face for
incomplete checks. The page and static link preview use Warm Midnight and locally
served Anton/Outfit fonts; font licenses are included alongside the files.
Post on X copies the PNG and opens a native dialog with a three-second countdown.
Hover/focus pauses the countdown, clicking opens immediately, and dismissal
cancels. Users paste the image into the prefilled composer and publish manually.
Clipboard failures retain download and an Open X link; popup blocking retains
a direct click action. The general URL never includes user inputs.

No addresses, names, nonces or result details enter analytics, URLs, persistent
storage or application APIs. Public RPCs and external avatar hosts can see the
functional requests and visitor metadata. Shared images expose the displayed identity and activity.

Preview from the repository root with `pnpm dev:website`, port 3030:
http://localhost:3030/bunker-mode. Avoid running Next build and dev concurrently
because they share `.next`.

Share-card artwork uses Zero Nonce/Safe?, Onchain Veteran/Rekt, No Private
Key/Safe? (green, happy mascot) for contracts, and Scan Unfinished/Not Checked
for incomplete RPC coverage. The status word is a stamp under the Bunker Mode title
in a softly blended tinted character panel; the mascot stands on the panel's bottom edge.
Ranked results are a right-aligned nonce leaderboard; unranked results show the
checked chain logos, dimming any network that did not answer.
Gold/silver/bronze rank the address's own top three positive signer nonces using
bigint comparisons; contract nonces and absent ranks are omitted. Active artwork
uses a transparent generated spiral-eye neutral mascot. See
`mascot-generation.md` for the exact generation prompt and reference assets.
