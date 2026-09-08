# Safe review warnings

`SafeTransactionWarnings.tsx` renders the shared presentation-only Safe transaction
risk analysis for external V3/V4 signatures and imported proposal review. It sits
outside clear-signing and simulation branches and recalculates for every payload.
The compact warnings use existing status tokens and native details/summary controls.

Delegatecall exemptions require exact chain deployment metadata and complete,
bounded CALL-only MultiSend decoding. An exemption is not a general safety verdict.
Nonzero signed gasPrice always shows gas reimbursement; details identify the payment
asset and explicit recipient or Transaction submitter. No estimates, remote metadata,
storage, signing, or simulation effects are introduced. The sticky decision reuses the shared warning popover and requires acknowledgement before signing/execution.

`useSafeRiskDecision.ts` binds checkbox and disclosure state to request identity,
exact payload, chain and selected actor/action. A changed review synchronously clears
both states, including navigating away and back. `SafeRiskDecision.tsx` reuses
`shared/WarningAcknowledgementPopover.tsx`, also used by SIWE. The primary button
and its UI handler both enforce acknowledgement; rejection remains available.
