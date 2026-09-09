# Fee payment

`../FeePaymentSelector.tsx` is the public compatibility facade.
`FeePaymentSelector.tsx` owns the fee picker;
`hooks/useFeePaymentQuote.ts` owns bounded quote preparation, pre-expiry refresh
and the five-attempt allowance;
`hooks/useFeePaymentOptions.ts` owns background option discovery and one automatic
funded-token selection per exact request. `model/automaticFeeToken.ts` is the pure
eligibility/balance decision. The parent review retains the quote and confirmation
authority; background eligibility and quote validation remain authoritative.

Single requests (including Send and bridge), batches, cross-dapp batches, Swap,
and Safe execution share this boundary. Manual selection wins for the current
request. Valid quotes refresh quietly up to five times; then expiry requires
explicit Retry, which resets the allowance. Provider failures also require Retry.
No automatic submission or fallback to native occurs. Tests live in `tests/feePayment/`.

`FeeQuoteError.tsx` owns bounded error layout and clipboard interaction;
`model/quoteError.ts` recognizes onchain signature expiry and projects concise
recovery copy without discarding the original diagnostic. In-wallet Swap owns
fresh-plan recovery via an explicit callback. `quoteError.test.ts` and the
refresh browser QA cover the separate transaction-signature expiry boundary.
