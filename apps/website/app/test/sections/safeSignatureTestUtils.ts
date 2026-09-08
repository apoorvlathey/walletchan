import { concatHex, encodeFunctionData, numberToHex, type Address, type Hex } from "viem";

// Safe 1.4.1 canonical MultiSend, matching the extension deployment registry.
export const TEST_SAFE_MULTISEND: Address = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";
const ZERO: Address = "0x0000000000000000000000000000000000000000";
const FIXTURE: Address = "0x000000000000000000000000000000000000dEaD";
const MULTISEND_ABI = [{ type: "function", name: "multiSend", stateMutability: "payable",
  inputs: [{ name: "transactions", type: "bytes" }], outputs: [] }] as const;

function batch(operation: 0 | 1, to: Address = FIXTURE, data: Hex = "0x"): Hex {
  return encodeFunctionData({ abi: MULTISEND_ABI, functionName: "multiSend", args: [concatHex([
    numberToHex(operation, { size: 1 }), to, numberToHex(0n, { size: 32 }),
    numberToHex((data.length - 2) / 2, { size: 32 }), data,
  ])] });
}

export const SAFE_SIGNATURE_CASES = [
  { id: "call", label: "Ordinary call, refunds disabled", expected: "No delegatecall or gas reimbursement warning." },
  { id: "delegate", label: "Arbitrary delegatecall", expected: "Delegatecall warning, even with empty calldata and zero value." },
  { id: "batch", label: "Canonical MultiSend, call-only contents", expected: "No delegatecall warning on Ethereum or Base. This does not imply the underlying calls are safe." },
  { id: "inner", label: "Canonical MultiSend, inner delegatecall", expected: "Delegatecall warning despite the official outer address." },
  { id: "nested", label: "Nested MultiSend delegatecall", expected: "Delegatecall warning. The nested official MultiSend address must not suppress it." },
  { id: "malformed", label: "Canonical MultiSend, malformed calldata", expected: "Delegatecall warning because the batch cannot be verified." },
  { id: "unknown", label: "Unknown MultiSend target", expected: "Delegatecall warning even though the encoded batch contains only ordinary calls." },
  { id: "refund", label: "Native refund to explicit recipient", expected: "Gas reimbursement warning; details show native asset and the fixture recipient." },
  { id: "submitter", label: "Native refund to transaction submitter", expected: "Gas reimbursement warning; zero refundReceiver is labeled Transaction submitter." },
  { id: "token", label: "Token refund", expected: "Gas reimbursement warning; details show the fixture gas token address." },
  { id: "both", label: "Delegatecall plus refund", expected: "Both warnings must appear together." },
  { id: "zero-price", label: "Nonzero refund fields, zero signed gas price", expected: "No gas reimbursement warning: signed gasPrice is zero." },
] as const;
export type SafeSignatureCase = typeof SAFE_SIGNATURE_CASES[number]["id"];

export function safeSignatureTestData(chainId: number, fixture: SafeSignatureCase) {
  const message = {
    to: FIXTURE, value: "0", data: "0x" as Hex, operation: 0,
    safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: ZERO,
    refundReceiver: ZERO, nonce: "9007199254740991",
  };
  if (["delegate", "batch", "inner", "nested", "malformed", "unknown", "both"].includes(fixture)) {
    message.operation = 1;
  }
  if (["batch", "inner", "nested", "malformed"].includes(fixture)) message.to = TEST_SAFE_MULTISEND;
  if (fixture === "batch" || fixture === "unknown") message.data = batch(0);
  if (fixture === "inner") message.data = batch(1);
  if (fixture === "nested") message.data = batch(1, TEST_SAFE_MULTISEND, batch(0));
  if (fixture === "malformed") message.data = "0x8d80ff0a";
  if (["refund", "submitter", "token", "both", "zero-price"].includes(fixture)) {
    message.baseGas = "21000";
    message.gasPrice = fixture === "zero-price" ? "0" : "1";
    message.refundReceiver = fixture === "submitter" ? ZERO : FIXTURE;
  }
  if (fixture === "token" || fixture === "zero-price") message.gasToken = FIXTURE;
  return {
    // Fixed fixture verifier, never a user-entered Safe or current nonce.
    // This page only requests signatures; it never submits them for execution.
    domain: { chainId, verifyingContract: FIXTURE },
    primaryType: "SafeTx",
    types: {
      EIP712Domain: [{ name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
      SafeTx: [
        { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "data", type: "bytes" }, { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" }, { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" }, { name: "nonce", type: "uint256" },
      ],
    },
    message,
  };
}
