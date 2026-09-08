"use client";

import { FormControl, FormLabel, Select, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useEip1193 } from "../hooks/useEip1193";
import { TestButton } from "./TestButton";
import { SAFE_SIGNATURE_CASES, safeSignatureTestData, type SafeSignatureCase } from "./safeSignatureTestUtils";

export function SafeSignatureTests() {
  const request = useEip1193();
  const { address } = useAccount();
  const chainId = useChainId();
  const [method, setMethod] = useState("eth_signTypedData_v4");
  if (!request || !address) return null;

  const run = async (fixture: SafeSignatureCase) => {
    await request({ method, params: [address, JSON.stringify(safeSignatureTestData(chainId, fixture))] });
    return "Signature returned (not submitted). Verify the expected warnings manually; signing success alone is not a passing test.";
  };

  return <>
    <Text id="safe-signatures" fontSize="sm" fontWeight="800" scrollMarginTop="80px">
      Safe transaction signature warnings
    </Text>
    <Text fontSize="xs" color="gray.600">
      Connect an owner EOA (private key, seed, Ledger, or Bankr), not an imported Safe.
      Use Ethereum or Base for the canonical MultiSend control. These fixtures use
      0x000000000000000000000000000000000000dEaD as the verifier and an artificial nonce.
      Open the sticky warning row: Sign must stay disabled until you check I understand. Inspect and reject each prompt, or use a disposable account to finish signing.
      Rejection appears as an error below and is expected for this manual review.
      No signatures are submitted or printed. Repeat with each signer type; Ledger
      signing completion needs the physical device.
    </Text>
    <FormControl>
      <FormLabel fontSize="xs" htmlFor="safe-signature-method">Signing method</FormLabel>
      <Select id="safe-signature-method" size="sm" value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="eth_signTypedData_v4">eth_signTypedData_v4</option>
        <option value="eth_signTypedData_v3">eth_signTypedData_v3 (regression control)</option>
      </Select>
    </FormControl>
    {SAFE_SIGNATURE_CASES.map((fixture) => <TestButton key={fixture.id}
      label={`SafeTx — ${fixture.label}`} description={`Expected: ${fixture.expected}`}
      onRun={() => run(fixture.id)} variant="outline" />)}
    <Text fontSize="sm" fontWeight="800">Imported Safe proposal check</Text>
    <Text fontSize="xs" color="gray.600">
      The buttons above test external signature prompts, not service-synced proposals.
      To check the separate in-wallet path, use a disposable Safe with a pending
      proposal created outside WalletChan with nonzero gasPrice. Refresh its Safe
      queue in WalletChan and review approval and execution: the gas reimbursement
      notice should appear and refund fields must match the original proposal.
      A zero refundReceiver should show Transaction submitter. Compare with a proposal
      whose gasPrice is zero: no reimbursement notice. Reject or close after review;
      execution is unnecessary. This page does not create or publish service proposals.
    </Text>
  </>;
}
