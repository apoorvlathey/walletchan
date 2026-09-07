import {
  announceProvider,
  setWindowEthereum,
} from "./announcement";
import type { ImpersonatorProvider } from "./provider";
import { setProviderInstance } from "./providerRegistry";

/**
 * Same-origin documents already share page authority. Reuse the top document's
 * provider so its bound methods retain the top-level content-script transport.
 * Never forward cross-origin postMessages or relax background sender checks.
 */
export function useSameOriginTopProvider(): boolean {
  let top: Window;
  try {
    if (!window.top || window.top === window) return false;
    top = window.top;
    // Access enforces the browser's same-origin/sandbox boundary, not a URL
    // supplied by the child. Opaque origins cannot opt into this path.
    if (window.location.origin === "null" ||
        top.location.origin !== window.location.origin) return false;
  } catch {
    return false;
  }

  const cleanup = () => {
    top.removeEventListener("eip6963:announceProvider", onAnnouncement);
    window.removeEventListener("pagehide", cleanup);
  };
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.info?.rdns !== "com.walletchan" ||
        typeof detail?.provider?.request !== "function") return;
    cleanup();
    // This is the actual top-realm object, not a new child-realm signer/router.
    const provider = detail.provider as ImpersonatorProvider;
    setProviderInstance(provider);
    setWindowEthereum(provider);
    announceProvider();
  };
  top.addEventListener("eip6963:announceProvider", onAnnouncement);
  window.addEventListener("pagehide", cleanup);
  // Covers both an already initialized top provider and a later announcement.
  top.dispatchEvent(new Event("eip6963:requestProvider"));
  return true;
}
