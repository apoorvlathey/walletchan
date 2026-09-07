# Arbitrum force-inclusion tests

This folder mirrors `src/chrome/arbitrumForceInclusion/`. Tests cover delayed
message encoding, Bridge preimage extraction, strict deadline eligibility, and
the trusted-UI router boundary without submitting live transactions.

Receipt validation regressions cover the Nitro EOA sender alias, uint160 wrap,
index zero, and rejection of sender/kind/data/index/prefix/child-hash mismatches.
