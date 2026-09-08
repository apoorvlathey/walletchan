"use client";

import { useAccount, useChainId } from "wagmi";
import { useEip1193 } from "../hooks/useEip1193";
import { TestButton } from "./TestButton";

const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
// Exact reported bytes, without the unrelated trailing space.
const DIRTY = "0xd73dd6230000100000000000000000009bd89d602f42724de67ce267f4b79581e719a1e3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export function LegacyApprovalTests() {
  const request = useEip1193();
  const { address } = useAccount();
  const chainId = useChainId();
  const disabled = !request || !address || chainId !== 1;
  const run = async (literal: boolean) => {
    if (!request || !address || chainId !== 1) throw new Error("Connect on Ethereum mainnet.");
    try {
      const result = await request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: LINK, data: literal ? `${DIRTY} ` : DIRTY, value: literal ? 0 : "0x0" }],
      });
      return { outcome: "FAIL: wallet returned a transaction result", result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const expected = literal
        ? /data is invalid|must be.*string/i.test(message)
        : /Non-zero high bytes.*increaseApproval/i.test(message);
      return { outcome: expected ? "PASS: rejected invalid request" : "INCONCLUSIVE: verify error; manual rejection does not prove protection", message };
    }
  };
  return <>
    <TestButton
      label="LINK increaseApproval: dirty address padding"
      description="Ethereum only. Exact reported spender and MAX_UINT amount; value is 0x0 and trailing whitespace removed. Expect automatic non-zero-high-bytes rejection. On an older wallet, inspect then Reject: confirming grants spending permission. Repeat with PK, seed, Ledger, and Bankr."
      onRun={() => run(false)} isDisabled={disabled} variant="outline"
    />
    <TestButton
      label="LINK increaseApproval: literal pasted report"
      description="Includes numeric value 0 and trailing whitespace. Expect invalid-request rejection; this case alone does not test the address-padding protection."
      onRun={() => run(true)} isDisabled={disabled} variant="outline"
    />
  </>;
}
