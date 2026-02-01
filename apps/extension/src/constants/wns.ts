/**
 * Wei Name Service (WNS) contract configuration
 * For resolving .wei names to addresses
 */

export const WNS_CONTRACT_ADDRESS = "0x0000000000696760E15f265e828DB644A0c242EB";

export const WEI_NODE = "0xa82820059d5df798546bcc2985157a77c3eef25eba9ba01899927333efacbd6f";

export const WNS_ABI = [
  "function resolve(uint256 tokenId) view returns (address)",
  "function reverseResolve(address addr) view returns (string)",
  "function computeId(string fullName) pure returns (uint256)",
];
