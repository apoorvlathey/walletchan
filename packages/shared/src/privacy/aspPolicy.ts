/** Resource budgets, not protocol tree capacities. Both consumers must agree. */
export const MAX_PRIVACY_ASP_LEAVES_PER_TREE = 100_000;
// Two trees of 100k canonical field strings (at most 77 digits + JSON overhead).
export const PRIVACY_ASP_LEAVES_RESPONSE_BYTES = 16_500_000;
export const PRIVACY_SNARK_SCALAR_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;

export interface PrivacyAspLeaves {
  aspLeaves: string[];
  stateTreeLeaves: string[];
}

export function parsePrivacyAspLeaves(value: unknown): PrivacyAspLeaves {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "aspLeaves,stateTreeLeaves") {
    throw new Error("Invalid ASP leaves");
  }
  const data = value as Record<string, unknown>;
  const parse = (input: unknown): string[] => {
    if (!Array.isArray(input) || input.length === 0) throw new Error("Invalid ASP leaves");
    if (input.length > MAX_PRIVACY_ASP_LEAVES_PER_TREE) {
      throw new Error("ASP tree exceeds verification capacity");
    }
    const seen = new Set<string>();
    const leaves = input.map((leaf: unknown) => {
      if (typeof leaf !== "string" || !/^[1-9]\d{0,76}$/.test(leaf) ||
        BigInt(leaf) >= PRIVACY_SNARK_SCALAR_FIELD || seen.has(leaf)) {
        throw new Error("Invalid ASP leaf");
      }
      seen.add(leaf);
      return leaf;
    });
    // Cached membership evidence must never be mutated after root computation.
    Object.freeze(leaves);
    return leaves;
  };
  return Object.freeze({ aspLeaves: parse(data.aspLeaves), stateTreeLeaves: parse(data.stateTreeLeaves) });
}
