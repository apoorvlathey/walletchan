import type { SignatureMethod } from "../requests/pendingSignatureStorage";

export function assertSupportedSignatureMethod(method: SignatureMethod): void {
  if (method === "eth_sign") {
    throw new Error(
      "eth_sign is deprecated and unsafe; use personal_sign or eth_signTypedData_v4",
    );
  }
  if (method === "eth_signTypedData") {
    throw new Error(
      "eth_signTypedData (v1) is deprecated; please use eth_signTypedData_v4",
    );
  }

}
