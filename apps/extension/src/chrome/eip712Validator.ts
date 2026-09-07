/** Stable, policy-free EIP-712 compatibility facade. */
export {
  INTERNAL_ACCOUNT_TYPED_DATA_ERROR,
  RAW_ERC7710_DELEGATION_SIGNATURE_ERROR,
  isRawErc7710DelegationSignatureRequest,
  validateEIP712TypedData,
} from "./signatures/eip712/validator";
export type { EIP712ValidationResult } from "./signatures/eip712/types";
