import { parsePrivacyAspLeaves, parsePrivacyFieldElement, type PrivacyAspLeaves } from "./types";

export interface PrivacyAspTreeRequest {
  version: 1;
  id: string;
  kind: "request";
  action: "compute-tree-roots";
  leaves: PrivacyAspLeaves;
}
export type PrivacyAspTreeResult = {
  version: 1;
  id: string;
  kind: "result";
  action: "compute-tree-roots";
} & ({ ok: true; mtRoot: string; onchainMtRoot: string } |
  { ok: false; code: "worker-runtime-failed" | "worker-launch-failed" | "worker-message-failed" | "worker-timeout" });

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === keys.sort().join(",");
}
function envelope(value: Record<string, unknown>, kind: string): boolean {
  return value.version === 1 && value.kind === kind && value.action === "compute-tree-roots" &&
    typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.id);
}
export function parsePrivacyAspTreeRequest(value: unknown): PrivacyAspTreeRequest | null {
  if (!exact(value, ["version", "id", "kind", "action", "leaves"]) || !envelope(value, "request")) return null;
  try {
    return { version: 1, id: value.id as string, kind: "request", action: "compute-tree-roots", leaves: parsePrivacyAspLeaves(value.leaves) };
  } catch { return null; }
}
export function parsePrivacyAspTreeResult(value: unknown): PrivacyAspTreeResult | null {
  if (typeof value !== "object" || value === null) return null;
  const result = value as Record<string, unknown>;
  if (!envelope(result, "result")) return null;
  if (result.ok === true && exact(result, ["version", "id", "kind", "action", "ok", "mtRoot", "onchainMtRoot"]) &&
    parsePrivacyFieldElement(result.mtRoot) !== null && parsePrivacyFieldElement(result.onchainMtRoot) !== null) {
    return result as unknown as PrivacyAspTreeResult;
  }
  if (result.ok === false && exact(result, ["version", "id", "kind", "action", "ok", "code"]) &&
    ["worker-runtime-failed", "worker-launch-failed", "worker-message-failed", "worker-timeout"].includes(String(result.code))) {
    return result as unknown as PrivacyAspTreeResult;
  }
  return null;
}
