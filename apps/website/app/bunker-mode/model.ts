import chains from "./chains.json";
export const BUNKER_CHAINS = chains;
export type ScanChain = (typeof chains)[number];
export type ChainResult = {
  chain: ScanChain;
  status: "clean" | "active" | "contract" | "error";
  nonce?: string;
};
export type Verdict = "clean" | "active" | "contract" | "incomplete";
export function verdictFor(results: ChainResult[]): Verdict {
  if (results.some((r) => r.status === "active")) return "active";
  if (
    results.length !== chains.length ||
    results.some((r) => r.status === "error")
  )
    return "incomplete";
  // Contract accounts have no private key of their own, so no key to expose.
  return results.some((r) => r.status === "contract") ? "contract" : "clean";
}
export function classifyNonce(
  chain: ScanChain,
  nonce: unknown,
  code: unknown,
): ChainResult {
  if (
    typeof nonce !== "string" ||
    !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(nonce) ||
    typeof code !== "string" ||
    !/^0x(?:[a-f0-9]{2})*$/i.test(code)
  )
    throw new Error("Malformed RPC response");
  const delegated = /^0xef0100[0-9a-f]{40}$/i.test(code);
  if (code !== "0x" && !delegated)
    return { chain, status: "contract", nonce: BigInt(nonce).toString() };
  return {
    chain,
    status: BigInt(nonce) > 0n || delegated ? "active" : "clean",
    nonce: BigInt(nonce).toString(),
  };
}
// Rank only positive signer nonces, preserving precision beyond Number.MAX_SAFE_INTEGER.
export function topNonceChains(results: ChainResult[]): ChainResult[] {
  return results
    .filter((r) => r.status === "active" && r.nonce && BigInt(r.nonce) > 0n)
    .sort((a, b) => {
      const left = BigInt(a.nonce!);
      const right = BigInt(b.nonce!);
      return left === right ? a.chain.id - b.chain.id : left > right ? -1 : 1;
    })
    .slice(0, 3);
}
export function cardCopy(verdict: Verdict, results: ChainResult[]) {
  const total = results.length;
  const active = results.filter((r) => r.status === "active").length;
  const failed = results.filter((r) => r.status === "error").length;
  if (verdict === "clean") return {
    title: "ZERO NONCE", lines: ["ZERO", "NONCE"], status: "SAFE?",
    caption: "No signed transactions on any chain checked.",
    color: "#4ade80",
  };
  if (verdict === "active") return {
    title: "ONCHAIN VETERAN", lines: ["ONCHAIN", "VETERAN"], status: "REKT",
    caption: `Signing activity on ${active} of ${total} chains.`,
    color: "#f87171",
  };
  if (verdict === "contract") return {
    title: "NO PRIVATE KEY", lines: ["NO PRIVATE", "KEY"], status: "SAFE?",
    caption: "Contract accounts have no private key to expose.",
    color: "#4ade80",
  };
  return {
    title: "SCAN UNFINISHED", lines: ["SCAN", "UNFINISHED"], status: "NOT CHECKED",
    caption: `${failed || "Some"} chain${failed === 1 ? "" : "s"} didn't respond. Run the check again.`,
    color: "#a1a1aa",
  };
}
