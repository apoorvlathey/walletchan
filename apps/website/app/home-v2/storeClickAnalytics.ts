"use client";

import { CHROME_STORE_URL } from "../constants";

export type StoreClickPlacement =
  | "homepage_hero"
  | "homepage_nav"
  | "homepage_final_cta";

type StoreClickInput = {
  href: string;
  placement: StoreClickPlacement;
  browser?: string;
};

type AnalyticsWindow = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const chromeStoreDestination = new URL(CHROME_STORE_URL);

export function buildStoreClickEvent({
  href,
  placement,
  browser,
}: StoreClickInput) {
  let destination: URL;

  try {
    destination = new URL(href);
  } catch {
    return null;
  }

  if (
    destination.origin !== chromeStoreDestination.origin ||
    destination.pathname !== chromeStoreDestination.pathname
  ) {
    return null;
  }

  return {
    name: "store_click",
    parameters: {
      store: "chrome_web_store",
      cta_placement: placement,
      link_url: destination.toString(),
      link_domain: destination.hostname,
      detected_browser: browser ?? "unknown",
    },
  } as const;
}

export function trackStoreClick(
  input: StoreClickInput,
  analyticsWindow: AnalyticsWindow | undefined =
    typeof window === "undefined" ? undefined : window,
) {
  const event = buildStoreClickEvent(input);
  if (!event || !analyticsWindow) {
    return false;
  }

  if (typeof analyticsWindow.gtag === "function") {
    analyticsWindow.gtag("event", event.name, event.parameters);
    return true;
  }

  analyticsWindow.dataLayer ??= [];
  analyticsWindow.dataLayer.push(["event", event.name, event.parameters]);
  return true;
}
