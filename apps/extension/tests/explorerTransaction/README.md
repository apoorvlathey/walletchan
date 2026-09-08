# Explorer Transaction Tests

This directory mirrors `src/chrome/explorerTransaction/` and covers the
authorization boundary and navigation/placement invariants for the
extension-owned explorer transaction frame. Pure explorer URL and RPC
transaction parsing remains under `tests/ui/`.

The recorded Monad transaction fixture covers the nested Safe execution /
MultiSend path in `tests/ui/explorerSafeExecutionModel.test.ts`, including
canonical-envelope rejection and preservation of existing Safe risk warnings.
