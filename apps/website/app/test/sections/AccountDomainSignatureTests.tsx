"use client";

import { FormControl, FormLabel, Input, Select, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { isAddress, type Address } from "viem";
import { useEip1193 } from "../hooks/useEip1193";
import { TestButton } from "./TestButton";
import { accountDomainTestData, expectAccountDomainBlock } from "./accountDomainTestUtils";

export function AccountDomainSignatureTests() {
  const request = useEip1193();
  const { address } = useAccount();
  const chainId = useChainId();
  const [otherAccount, setOtherAccount] = useState("");
  const [encoding, setEncoding] = useState("json");
  if (!request || !address) return null;

  const run = (method: string, verifier = address, generic = false) => {
    const typedData = accountDomainTestData(verifier, chainId, generic);
    return expectAccountDomainBlock(() => request({
      method,
      params: [address, encoding === "json" ? JSON.stringify(typedData) : typedData],
    }));
  };

  return <>
    <Text id="account-domain-signatures" fontSize="sm" fontWeight="800" scrollMarginTop="80px">
      Account-domain signature protection
    </Text>
    <Text fontSize="xs" color="gray.600">
      Expected: automatic rejection with PASS below. If a signing prompt appears,
      reject it; manual rejection is inconclusive. Uses the connected chain and
      zero-value test data. No transactions are submitted. Delegation need not be enabled.
    </Text>
    <FormControl>
      <FormLabel fontSize="xs" htmlFor="account-domain-encoding">Payload encoding</FormLabel>
      <Select id="account-domain-encoding" size="sm" value={encoding} onChange={(event) => setEncoding(event.target.value)}>
        <option value="json">JSON string</option>
        <option value="object">Object</option>
      </Select>
    </FormControl>
    <TestButton label="PackedUserOperation — V4, signer as verifier"
      description="MetaMask DeleGator execution-signature regression. Expected: blocked before signing."
      onRun={() => run("eth_signTypedData_v4")} variant="outline" />
    <TestButton label="PackedUserOperation — V3, signer as verifier"
      description="The same execution payload through the V3 method. Expected: blocked."
      onRun={() => run("eth_signTypedData_v3")} variant="outline" />
    <TestButton label="Generic self-call — V4, signer as verifier"
      description="AccountAction with a zero-value self-call and hex data. Checks that rejection does not depend on the PackedUserOperation name."
      onRun={() => run("eth_signTypedData_v4", address, true)} variant="outline" />
    <TestButton label="Another wallet account as verifier — V4"
      description="Paste another private-key, seed, Ledger, or Bankr account stored in WalletChan. Expected: blocked even though signer and verifier differ. Imported Safes are excluded so owner signatures keep working."
      onRun={() => run("eth_signTypedData_v4", otherAccount.trim() as Address)}
      isDisabled={!isAddress(otherAccount.trim(), { strict: false }) || otherAccount.trim().toLowerCase() === address.toLowerCase()}
      variant="outline">
      <FormControl>
        <FormLabel fontSize="xs" htmlFor="account-domain-other">Other signing EOA in WalletChan</FormLabel>
        <Input id="account-domain-other" size="sm" value={otherAccount}
          onChange={(event) => setOtherAccount(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
      </FormControl>
    </TestButton>
  </>;
}
