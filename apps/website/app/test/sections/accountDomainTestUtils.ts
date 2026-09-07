import { isAddress, type Address } from "viem";

const DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

export function accountDomainTestData(
  verifyingContract: Address,
  chainId: number,
  generic = false,
) {
  if (!isAddress(verifyingContract, { strict: false })) {
    throw new Error("Enter a valid address for another account in your wallet.");
  }
  return {
    domain: {
      name: generic ? "WalletChan Account Domain Test" : "EIP7702StatelessDeleGator",
      version: "1",
      chainId,
      verifyingContract,
    },
    primaryType: generic ? "AccountAction" : "PackedUserOperation",
    types: {
      EIP712Domain: DOMAIN_FIELDS,
      ...(generic ? {
        AccountAction: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      } : {
        PackedUserOperation: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "entryPoint", type: "address" },
        ],
      }),
    },
    // Deliberately non-executable: no calls, gas allowance, or live nonce lookup.
    // These requests exercise signing policy only; nothing is ever submitted.
    message: generic ? { target: verifyingContract, value: "0", data: "0xdeadbeef" } : {
      sender: verifyingContract,
      nonce: "0",
      initCode: "0x",
      callData: "0x",
      accountGasLimits: `0x${"00".repeat(32)}`,
      preVerificationGas: "0",
      gasFees: `0x${"00".repeat(32)}`,
      paymasterAndData: "0x",
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    },
  };
}

export async function expectAccountDomainBlock(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "message" in error
      ? String(error.message) : String(error);
    if (message.includes("External signature requests cannot use wallet accounts as the verifying contract.")) {
      return { status: "PASS", detail: "WalletChan blocked the account-domain signature.", walletError: message };
    }
    throw new Error(`INCONCLUSIVE: Expected the account-domain policy rejection. Wallet returned: ${message}`);
  }
  // Do not display or retain an unexpectedly returned signature.
  throw new Error("FAIL: The wallet returned a signature instead of blocking this request. Reload the updated extension and retry.");
}
