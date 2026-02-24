import type { Address, PublicClient } from "viem";
import { erc20Abi } from "viem";
import { permit2Abi } from "./abis";
import { getAddresses } from "./addresses";

export interface PermitSingleData {
  details: {
    token: Address;
    amount: bigint;
    expiration: number;
    nonce: number;
  };
  spender: Address;
  sigDeadline: bigint;
}

/** Read Permit2 allowance (amount, expiration, nonce) for owner→spender on token */
export async function getPermit2Allowance(
  client: PublicClient,
  chainId: number,
  owner: Address,
  spender: Address
): Promise<{ amount: bigint; expiration: number; nonce: number }> {
  const { permit2, wchan } = getAddresses(chainId);
  const result = await client.readContract({
    address: permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [owner, wchan, spender],
  });
  return {
    amount: BigInt(result[0]),
    expiration: Number(result[1]),
    nonce: Number(result[2]),
  };
}

/** Check if WCHAN ERC20 allowance to Permit2 is sufficient */
export async function getErc20AllowanceToPermit2(
  client: PublicClient,
  chainId: number,
  owner: Address
): Promise<bigint> {
  const { wchan, permit2 } = getAddresses(chainId);
  return client.readContract({
    address: wchan,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, permit2],
  });
}

/** Build PermitSingle struct for signing */
export function buildPermitSingle(
  chainId: number,
  amount: bigint,
  nonce: number,
  spender: Address
): PermitSingleData {
  const { wchan } = getAddresses(chainId);
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

  return {
    details: {
      token: wchan,
      amount,
      expiration: thirtyDays,
      nonce,
    },
    spender,
    sigDeadline,
  };
}

/** Get EIP-712 typed data for signTypedData */
export function getPermitTypedData(
  chainId: number,
  permitSingle: PermitSingleData
) {
  const { permit2 } = getAddresses(chainId);
  return {
    domain: {
      name: "Permit2" as const,
      chainId,
      verifyingContract: permit2,
    },
    types: {
      PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ],
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
        { name: "expiration", type: "uint48" },
        { name: "nonce", type: "uint48" },
      ],
    },
    primaryType: "PermitSingle" as const,
    message: {
      details: {
        token: permitSingle.details.token,
        amount: permitSingle.details.amount,
        expiration: permitSingle.details.expiration,
        nonce: permitSingle.details.nonce,
      },
      spender: permitSingle.spender,
      sigDeadline: permitSingle.sigDeadline,
    },
  };
}
