"use client";

import { FormControl, FormLabel, Select, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { recoverTypedDataAddress, type Hex } from "viem";
import { useEip1193 } from "../hooks/useEip1193";
import { TestButton } from "./TestButton";

export function TypedDataChainIdTests() {
  const request = useEip1193();
  const { address } = useAccount();
  const chainId = useChainId();
  const [encoding, setEncoding] = useState("json");
  const [method, setMethod] = useState("eth_signTypedData_v4");
  if (!request || !address) return null;

  const run = async (domainChainId: number | string, negative = false) => {
    const typedData = {
      domain: { name: "WalletChan Chain ID Test", version: "1", chainId: domainChainId },
      types: {
        EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }],
        TestMessage: [{ name: "contents", type: "string" }],
      },
      primaryType: "TestMessage",
      message: { contents: "Testing chain ID encoding. No spending authorization." },
    };
    let signature: unknown;
    try {
      signature = await request({ method, params: [address, encoding === "json" ? JSON.stringify(typedData) : typedData] });
    } catch (error) {
      if (!negative) throw error;
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
      if (/Invalid EIP-712 domain chainId|EIP-712 domain chainId is out of range/.test(message)) {
        return { status: "PASS", detail: "Bankr chain ID rejected locally", walletError: message };
      }
      throw new Error(`INCONCLUSIVE: Expected Bankr chain ID rejection. Wallet returned: ${message}`);
    }
    if (negative) throw new Error("FAIL: Wallet returned a signature for an invalid chain ID.");
    if (typeof signature !== "string") throw new Error("FAIL: Wallet did not return a signature.");
    const recovered = await recoverTypedDataAddress({ ...typedData, signature: signature as Hex } as never);
    if (recovered.toLowerCase() !== address.toLowerCase()) throw new Error("FAIL: Signature does not match the original payload and connected account.");
    return { status: "PASS", chainId: domainChainId, recoveredSigner: recovered, detail: "Signature verified against the original payload" };
  };

  return <>
    <Text id="typed-data-chain-id" fontSize="sm" fontWeight="800" scrollMarginTop="80px">Typed-data chain ID encoding</Text>
    <Text fontSize="xs" color="gray.600">
      Decimal and hex strings should sign with Bankr, private-key, seed-phrase, and Ledger accounts.
      Uses the connected chain ({chainId}) and a harmless message. PASS verifies the signature against the original payload.
      Negative cases are Bankr-specific; Ledger requires a physical device.
    </Text>
    <FormControl>
      <FormLabel htmlFor="chain-id-method" fontSize="xs">Signing method</FormLabel>
      <Select id="chain-id-method" size="sm" value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="eth_signTypedData_v4">eth_signTypedData_v4</option>
        <option value="eth_signTypedData_v3">eth_signTypedData_v3</option>
      </Select>
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="chain-id-encoding" fontSize="xs">Payload encoding</FormLabel>
      <Select id="chain-id-encoding" size="sm" value={encoding} onChange={(event) => setEncoding(event.target.value)}>
        <option value="json">JSON string</option>
        <option value="object">Object</option>
      </Select>
    </FormControl>
    <TestButton label={`Chain ID — decimal string "${chainId}"`} onRun={() => run(String(chainId))} />
    <TestButton label={`Chain ID — hex string "0x${chainId.toString(16)}"`} onRun={() => run(`0x${chainId.toString(16)}`)} />
    <TestButton label="Chain ID — number (control)" onRun={() => run(chainId)} />
    <TestButton label="Bankr negative — fractional chain ID" description="Expected: local rejection, with PASS below. Manual rejection is inconclusive." onRun={() => run("1.5", true)} variant="outline" />
    <TestButton label="Bankr negative — unsafe chain ID" description="9007199254740992 exceeds the safe JSON integer range. Expected: local rejection." onRun={() => run("9007199254740992", true)} variant="outline" />
  </>;
}
