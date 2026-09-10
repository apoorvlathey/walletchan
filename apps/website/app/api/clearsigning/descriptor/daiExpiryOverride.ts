const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const FORMAT = "Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Temporary presentation fix until upstream supports conditional sentinel dates.
 * https://github.com/ethereum/clear-signing-erc7730-registry/issues/2894
 * Uses existing enum + ifNotIn support: nonzero expiry also shows its raw value.
 * Never mutate the cached upstream descriptor or override a future upstream fix.
 */
export function applyDaiExpiryOverride<T extends {
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  display?: { formats?: Record<string, unknown> };
}>(descriptor: T, chainId: string, address: string, kind: string): T {
  if (chainId !== "1" || address.toLowerCase() !== DAI || kind !== "eip712") return descriptor;
  const context = descriptor.context?.eip712;
  if (!isRecord(context) || !isRecord(context.domain)) return descriptor;
  if (context.domain.name !== "Dai Stablecoin" || context.domain.version !== "1") return descriptor;
  if (!Array.isArray(context.deployments) || !context.deployments.some((deployment) =>
    isRecord(deployment) && deployment.chainId === 1 &&
    typeof deployment.address === "string" && deployment.address.toLowerCase() === DAI
  )) return descriptor;
  const format = descriptor.display?.formats?.[FORMAT];
  if (!isRecord(format) || !Array.isArray(format.fields)) return descriptor;
  const expiryFields = format.fields.filter((field) => isRecord(field) && field.path === "expiry");
  if (expiryFields.length !== 1) return descriptor;
  const field = expiryFields[0];
  if (!isRecord(field) || field.format !== "date" || field.visible !== "always" ||
      !isRecord(field.params) || field.params.encoding !== "timestamp") return descriptor;
  return {
    ...descriptor,
    metadata: {
      ...descriptor.metadata,
      enums: {
        ...(isRecord(descriptor.metadata?.enums) ? descriptor.metadata.enums : {}),
        // Older enum renderers match strings literally, unlike ifNotIn.
        walletchanDaiPermitExpiry: {
          "0": "Never expires",
          "0x0": "Never expires",
          "0x00": "Never expires",
          [`0x${"0".repeat(64)}`]: "Never expires",
        },
      },
    },
    display: {
      ...descriptor.display,
      formats: {
        ...descriptor.display?.formats,
        [FORMAT]: {
          ...format,
          fields: format.fields.flatMap((candidate) => candidate === field ? [
            { ...field, visible: { ifNotIn: ["0"] } },
            {
              path: "expiry", label: "Permit expiry", format: "enum",
              params: { $ref: "$.metadata.enums.walletchanDaiPermitExpiry" }, visible: "always",
            },
          ] : [candidate]),
        },
      },
    },
  };
}
