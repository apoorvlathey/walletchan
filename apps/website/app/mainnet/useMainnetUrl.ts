"use client";

import { useCallback } from "react";

/**
 * On mainnet.walletchan.com the /mainnet route is served at /.
 * Internal links need to drop the /mainnet prefix when on the subdomain.
 */
function isSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "mainnet.walletchan.com";
}

/** Convert a /mainnet/* path to the correct href for the current host. */
export function mainnetHref(path: string): string {
  if (!isSubdomain()) return path;
  // "/mainnet" -> "/", "/mainnet/claim?tx=0x..." -> "/claim?tx=0x..."
  if (path === "/mainnet") return "/";
  if (path.startsWith("/mainnet/")) return path.slice("/mainnet".length);
  return path;
}

export function useMainnetUrl() {
  return useCallback(mainnetHref, []);
}
