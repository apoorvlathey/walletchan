/**
 * MegaNames (.mega) resolution utility
 *
 * Contract: 0x5B424C6CCba77b32b9625a6fd5A30D409d20d997 on MegaETH (chain 4326)
 * Forward: ownerOf(uint256 tokenId) -> address (tokenId = uint256(namehash("label.mega")))
 *          Falls back to addr(uint256) if owner is zero (e.g. subdomain with explicit addr set)
 * Reverse: getName(address) -> string
 */

export const MEGA_NAMES_CONTRACT =
  "0x5B424C6CCba77b32b9625a6fd5A30D409d20d997" as const;

export const MEGAETH_CHAIN_ID = 4326;

export function isMega(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  return name.toLowerCase().endsWith(".mega");
}

export const megaNamesAbi = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getName",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
