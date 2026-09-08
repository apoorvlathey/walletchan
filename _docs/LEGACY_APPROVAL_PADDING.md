# Legacy increaseApproval dirty padding

## Finding and local evidence (2026-09-08)

Affected before this change: the selector-based review guard recognized
`increaseAllowance` but omitted `increaseApproval(address,uint256)` (`0xd73dd623`).
With the reported 68-byte payload, `detectAbiEncodingError` returned
`{malformed:false}`, while ethers parsed the function but threw a deferred ABI
error when reading `args[0]`. The failure to decode did not itself disable Confirm.

The literal report is rejected separately by current ingress: its data has a
trailing space and its value is numeric `0`. Removing that space and using
`value: "0x0"` isolates the actual encoding bypass.

Chainlink's [official LINK repository](https://github.com/smartcontractkit/LinkToken)
identifies Ethereum `0x514910771AF9Ca656af840dff83E8264EcF986CA` as the old Solidity
0.4 deployment. We verified LINK specifically; this does not establish the
report's claims about every other named token.

A read-only `eth_call` to LINK returned ABI `true`. On an isolated Anvil mainnet
fork, the same call from the default disposable Anvil account succeeded:

- Local transaction: `0x4da1ff6ac36555b2f40ad5c7fad148cb15f025bbd510335ed94e37d8e6d24fcb`
- Local receipt block: `0x18bb412`; status `0x1`; gas used `0xb754`.
- Approval event spender: `0x9bd89d602f42724de67ce267f4b79581e719a1e3`.
- Post-call allowance: `2^256 - 1`, confirmed by `allowance(owner, spender)`.

No live transaction was sent. The old contract discards the dirty high address
bytes, whereas the wallet decoder rejects their ABI representation. An existing
nonzero allowance may cause a MAX_UINT increase to overflow/revert; the local
reproduction used a fresh owner with zero allowance.

## Repeat the isolated contract reproduction

Requires Foundry. Start a dedicated fork (add `--fork-block-number 25932817`
for the parent block of the recorded local receipt if the RPC serves that state):

```sh
anvil --fork-url https://ethereum-rpc.publicnode.com --port 18545
```

In a second terminal, submit only to the local node:

```sh
cast rpc --rpc-url http://127.0.0.1:18545 eth_sendTransaction '{"from":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","to":"0x514910771AF9Ca656af840dff83E8264EcF986CA","data":"0xd73dd6230000100000000000000000009bd89d602f42724de67ce267f4b79581e719a1e3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","value":"0x0"}'
cast call 0x514910771AF9Ca656af840dff83E8264EcF986CA 'allowance(address,address)(uint256)' 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 0x9bd89d602f42724de67ce267f4b79581e719a1e3 --rpc-url http://127.0.0.1:18545
```

Expected allowance is `115792089237316195423570985008687907853269984665640564039457584007913129639935`.
Stop Anvil afterward. No wallet connection or real keys are needed.

## Mitigation and scope

- Add both legacy increaseApproval and decreaseApproval to the shared exact-length,
  zero-address-padding guard. Do not truncate, repair, or re-encode the request.
- Enforce that existing known-selector policy at injected/WalletConnect single
  and batch ingress, before requests reach any signer. Retain review checks for
  older queued single/batch requests.
- Include canonical legacy allowance mutations in approval-intent discovery so
  the existing post-state verification can report final allowances.
- Unknown functions, arbitrary nested wrappers, and deployment initcode are not
  covered by this finite ABI selector policy. This is not a universal calldata
  validator or proof that an arbitrary transaction is safe.

## Manual wallet QA

Reload `apps/extension/build/`, open the website `/test`, and expand Send
Transaction. Connect on Ethereum; both LINK controls are disabled on other chains.

1. Run **LINK increaseApproval: dirty address padding**. Expect an automatic
   non-zero-high-bytes error naming increaseApproval and a PASS result. No signing
   or Ledger device prompt should occur. On an old build, inspect then Reject;
   confirming on mainnet would authorize the reported spender.
2. Run **LINK increaseApproval: literal pasted report**. Expect invalid-request
   rejection; this does not prove address-padding protection.
3. Repeat with private-key, seed-phrase, Ledger, and Bankr accounts, using master
   and agent sessions where applicable. View-only accounts must never sign.
4. For queued-request UI QA, open preview `/preview/tx` with
   `scenario=legacy-approval-dirty`, `wallet=privateKey|seedPhrase|bankr|viewOnly`.
   Expect malformed-calldata explanation and disabled Confirm for signing accounts.

Automated encoding tests cover every high address byte, valid controls, invalid
length/hex, singles/batches, and legacy simulation intent semantics. Provider and
WalletConnect regressions plus account/session and Ledger no-device tests ran.
Rendered Chrome preview checks confirmed disabled Confirm for private-key, seed,
and Bankr, and no Confirm button for view-only. Both project typechecks and the
full extension build passed. The focused suite passed 117 tests and the
account/session/Ledger suite passed 38. The subsequent nine-test padding run
also passed, including the added all-account preflight and WalletConnect case.
UI architecture passed, but the existing
module-size test fails on unchanged `Settings/settingsRegistry.tsx` (456 lines,
budget 455). The preview URL snapshot also needed its already-existing Safe
signature scenarios added to the expected list.

Physical Ledger QA is outstanding; the preview harness does not model Ledger.
