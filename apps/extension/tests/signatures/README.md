# Signature tests

These tests cover signature confirmation/release policy and the bounded EIP-712
schema, sanitization, delegation, and prototype-safety boundaries. The EIP-712
implementation mirrors `chrome/signatures/eip712/`; architecture coverage
freezes ownership/export identity while policy coverage freezes raw-delegation
and method-routing behavior.

`accountDomainPolicy.test.ts` exercises MetaMask execution-signature phishing,
case-insensitive V3/V4 account-domain rejection, and internal UserOperation
compatibility. `confirmationHandlers.test.ts` uses the real confirmation policy
for all four signer handlers, stale requests, SIWE override isolation, and
account-import races at release, and imported Safe owner-signature compatibility.
`transactions/requestIntake.test.ts` exercises both injected and WalletConnect
EOA-domain rejection before persistence and SafeTx acceptance for all four owners.

Review regressions also cover deprecated methods in old pending records,
malformed field definitions, selected-account changes, import-during-signing
races across all four transports, and unchanged permit/batch signing digests.
Ledger confirmation/release success uses mocked device I/O; real-device QA is
still required. Low-level internal Safe/UserOperation signatures remain covered
separately and are not routed through the external-request policy.
