# Bankr boundary tests

These tests cover bounded Bankr responses, credential-to-request binding,
submission races, and chat egress. They exercise the
remote signer boundary without mixing it into local-key tests.

Local swap account/effect ordering lives in `../transactions/`.

`typedData.test.ts` covers immutable normalization, exact EIP-712 digest
preservation, optional chain IDs, and invalid/unsafe inputs. `bankrApiSecurity.test.ts`
checks numeric API bodies through the real signing boundary for V3/V4 and
JSON/object payloads, original-payload signature recovery, and rejection before HTTP.

`architecture.test.ts` freezes the transport/response/effect dependency
direction, domain aggregate identities, and empty Bankr/chat root namespace.
