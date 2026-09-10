"use client";

import { Text } from "@chakra-ui/react";
import { useAccount, useChainId } from "wagmi";
import {
  encodeFunctionData,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { useEip1193 } from "../hooks/useEip1193";
import { TEST_CHAINS } from "../constants";
import { TestButton } from "./TestButton";

/**
 * Fixtures aimed specifically at the ERC-7730 clear-signing layer. Each
 * button targets a contract + selector / primaryType that has a descriptor
 * in the ethereum/clear-signing-erc7730-registry — so the wallet should
 * render the human-readable card on top of the raw decoder.
 */

const PERMIT2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const DAI: Address = "0x6b175474e89094c44da98b954eedeac495271d0f";
const DAI_PERMIT_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Permit: [
    { name: "holder", type: "address" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "allowed", type: "bool" },
  ],
} as const;

// Aave V3 Pool — covered in the ERC-7730 registry across most major chains.
// Picked over Uniswap because the registry only has Uniswap V3 SwapRouter02 on
// mainnet, while Aave V3 spans Mainnet / Base / Polygon / Arbitrum / Optimism —
// matches our test chain set. Source: registry/aave/calldata-lpv3.json.
const AAVE_V3_POOL_BY_CHAIN: Record<number, Address> = {
  1: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  137: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  10: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
};

const AAVE_V3_POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to)",
]);

const PERMIT2_PERMIT_SINGLE_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
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
} as const;

const PERMIT2_PERMIT_BATCH_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  PermitBatch: [
    { name: "details", type: "PermitDetails[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

const UNI_SPENDER: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 itself, harmless target

export function ClearSigningSection() {
  const request = useEip1193();
  const { address } = useAccount();
  const chainId = useChainId();
  const chain = TEST_CHAINS[chainId];
  const usdc = chain?.usdc;
  const aavePool = AAVE_V3_POOL_BY_CHAIN[chainId];
  const aaveSupported = !!aavePool && !!usdc;

  if (!request || !address) {
    return (
      <Text fontSize="sm" color="gray.500">
        Connect a wallet to enable these tests.
      </Text>
    );
  }

  // Display fixtures only: self-spender, fixed nonce, no onchain submission.
  const signDaiPermit = (neverExpires: boolean) => {
    if (chainId !== 1) throw new Error("Switch to Ethereum to test DAI permits.");
    const expiry = neverExpires ? 0 : Math.floor(Date.now() / 1000) + 24 * 3600;
    return request({
      method: "eth_signTypedData_v4",
      params: [
        address,
        JSON.stringify({
          domain: {
            name: "Dai Stablecoin",
            version: "1",
            chainId: 1,
            verifyingContract: DAI,
          },
          types: DAI_PERMIT_TYPES,
          primaryType: "Permit",
          message: {
            holder: address,
            spender: address,
            nonce: "0",
            expiry: expiry.toString(),
            allowed: true,
          },
        }),
      ],
    });
  };

  // ------------------------------------------------------------------------
  // Permit2 — EIP-712 signature, chain-agnostic
  // ------------------------------------------------------------------------

  const signPermit2Single = () => {
    if (!usdc) throw new Error(`No USDC configured on ${chain?.name ?? chainId}`);
    const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const sigDeadline = Math.floor(Date.now() / 1000) + 3600;
    return request({
      method: "eth_signTypedData_v4",
      params: [
        address,
        JSON.stringify({
          domain: {
            name: "Permit2",
            chainId,
            verifyingContract: PERMIT2,
          },
          types: PERMIT2_PERMIT_SINGLE_TYPES,
          primaryType: "PermitSingle",
          message: {
            details: {
              token: usdc.address,
              amount: parseUnits("100", usdc.decimals).toString(),
              expiration: expiration.toString(),
              nonce: "0",
            },
            spender: UNI_SPENDER,
            sigDeadline: sigDeadline.toString(),
          },
        }),
      ],
    });
  };

  const signPermit2Batch = () => {
    if (!usdc) throw new Error(`No USDC configured on ${chain?.name ?? chainId}`);
    const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const sigDeadline = Math.floor(Date.now() / 1000) + 3600;
    return request({
      method: "eth_signTypedData_v4",
      params: [
        address,
        JSON.stringify({
          domain: {
            name: "Permit2",
            chainId,
            verifyingContract: PERMIT2,
          },
          types: PERMIT2_PERMIT_BATCH_TYPES,
          primaryType: "PermitBatch",
          message: {
            details: [
              {
                token: usdc.address,
                amount: parseUnits("100", usdc.decimals).toString(),
                expiration: expiration.toString(),
                nonce: "0",
              },
              {
                token: usdc.address,
                amount: parseUnits("250", usdc.decimals).toString(),
                expiration: expiration.toString(),
                nonce: "1",
              },
            ],
            spender: UNI_SPENDER,
            sigDeadline: sigDeadline.toString(),
          },
        }),
      ],
    });
  };

  // ------------------------------------------------------------------------
  // Aave V3 Pool — calldata, multi-chain (Mainnet, Base, Polygon, Arbitrum,
  // Optimism). The registry's lpv3 descriptor declares deployments for all
  // of these so the wallet should render the human-readable card on any.
  // ------------------------------------------------------------------------

  const aaveSupplyUSDC = () => {
    if (!aavePool || !usdc) {
      throw new Error(`Aave V3 not in registry for ${chain?.name ?? chainId}`);
    }
    const data: Hex = encodeFunctionData({
      abi: AAVE_V3_POOL_ABI,
      functionName: "supply",
      args: [usdc.address, parseUnits("100", usdc.decimals), address, 0],
    });
    return request({
      method: "eth_sendTransaction",
      params: [
        {
          from: address,
          to: aavePool,
          data,
          value: "0x0",
        },
      ],
    });
  };

  const aaveWithdrawUSDC = () => {
    if (!aavePool || !usdc) {
      throw new Error(`Aave V3 not in registry for ${chain?.name ?? chainId}`);
    }
    const data: Hex = encodeFunctionData({
      abi: AAVE_V3_POOL_ABI,
      functionName: "withdraw",
      args: [usdc.address, parseUnits("50", usdc.decimals), address],
    });
    return request({
      method: "eth_sendTransaction",
      params: [
        {
          from: address,
          to: aavePool,
          data,
          value: "0x0",
        },
      ],
    });
  };

  // ------------------------------------------------------------------------
  // Batch: ERC-20 approve (no descriptor) + Aave supply 100 + Aave withdraw 50
  // — exercises per-call clear-signing inside BatchTransactionConfirmation
  // with two descriptor-matched calls so the top summary renders two cards
  // labeled "Call 2 of 3" and "Call 3 of 3".
  // ------------------------------------------------------------------------

  const sendAaveSupplyBatch = () => {
    if (!aavePool || !usdc) {
      throw new Error(`Aave V3 not in registry for ${chain?.name ?? chainId}`);
    }
    const approveData: Hex = encodeFunctionData({
      abi: parseAbi(["function approve(address spender, uint256 value)"]),
      functionName: "approve",
      args: [aavePool, parseUnits("100", usdc.decimals)],
    });
    const supplyData: Hex = encodeFunctionData({
      abi: AAVE_V3_POOL_ABI,
      functionName: "supply",
      args: [usdc.address, parseUnits("100", usdc.decimals), address, 0],
    });
    const withdrawData: Hex = encodeFunctionData({
      abi: AAVE_V3_POOL_ABI,
      functionName: "withdraw",
      args: [usdc.address, parseUnits("50", usdc.decimals), address],
    });
    return request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0.0",
          from: address,
          chainId: `0x${chainId.toString(16)}`,
          atomicRequired: true,
          calls: [
            { to: usdc.address, data: approveData, value: "0x0" },
            { to: aavePool, data: supplyData, value: "0x0" },
            { to: aavePool, data: withdrawData, value: "0x0" },
          ],
        },
      ],
    });
  };

  return (
    <>
      <TestButton
        label="DAI Permit — never expires (Ethereum)"
        description="Expiry is 0, meaning no permit deadline. Compare the Valid until row (currently shown as —). Switch to Ethereum. Uses your own address as spender; signature only, no submission."
        onRun={() => signDaiPermit(true)}
        isDisabled={chainId !== 1}
      />
      <TestButton
        label="DAI Permit — 24-hour expiry (Ethereum)"
        description="Expiry is 24 hours from clicking Run. Valid until should show tomorrow’s local date and time. Switch to Ethereum. Uses your own address as spender; signature only, no submission."
        onRun={() => signDaiPermit(false)}
        isDisabled={chainId !== 1}
      />
      <TestButton
        label={`Permit2 PermitSingle (sig, ${chain?.name ?? "?"})`}
        description='Authorize Permit2 to spend 100 USDC for 30 days. Should render the clear-signing card with "Authorize spending of token" intent, amount in USDC, expiry date.'
        onRun={signPermit2Single}
        isDisabled={!usdc}
      />
      <TestButton
        label={`Permit2 PermitBatch (sig, ${chain?.name ?? "?"})`}
        description="Authorize spending of two token entries. Exercises EIP-712 array iteration (`details.[]`) in the descriptor."
        onRun={signPermit2Batch}
        isDisabled={!usdc}
      />
      <TestButton
        label={`Aave V3 — supply 100 USDC (${chain?.name ?? "?"})`}
        description="Deposit 100 USDC into the Aave V3 Pool. Should render the human-readable card with the asset, amount, and beneficiary. Supported on Mainnet, Base, Polygon, Arbitrum, Optimism."
        onRun={aaveSupplyUSDC}
        isDisabled={!aaveSupported}
      />
      <TestButton
        label={`Aave V3 — withdraw 50 USDC (${chain?.name ?? "?"})`}
        description="Withdraw 50 USDC from the Aave V3 Pool. Tests a second function on the same descriptor."
        onRun={aaveWithdrawUSDC}
        isDisabled={!aaveSupported}
      />
      <TestButton
        label={`Batch: approve + supply 100 + withdraw 50 (${chain?.name ?? "?"})`}
        description="ERC-5792 batch with three calls — plain ERC-20 approve (no descriptor), Aave supply 100 USDC (descriptor), Aave withdraw 50 USDC (descriptor). Exercises the top-of-screen clear-signing summary with two matched cards labeled 'Call 2 of 3' and 'Call 3 of 3'."
        onRun={sendAaveSupplyBatch}
        isDisabled={!aaveSupported}
      />
    </>
  );
}
