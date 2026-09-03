import assert from "node:assert/strict";
import test from "node:test";
import { CHROME_STORE_URL, FIREFOX_STORE_URL } from "../app/constants";
import {
  buildStoreClickEvent,
  trackStoreClick,
} from "../app/home-v2/storeClickAnalytics";

test("builds a Store-specific event with attribution parameters", () => {
  assert.deepEqual(
    buildStoreClickEvent({
      href: `${CHROME_STORE_URL}?utm_source=x`,
      placement: "homepage_hero",
      browser: "brave",
    }),
    {
      name: "store_click",
      parameters: {
        store: "chrome_web_store",
        cta_placement: "homepage_hero",
        link_url: `${CHROME_STORE_URL}?utm_source=x`,
        link_domain: "chromewebstore.google.com",
        detected_browser: "brave",
      },
    },
  );
});

test("does not track Firefox or unrelated destinations", () => {
  assert.equal(
    buildStoreClickEvent({
      href: FIREFOX_STORE_URL,
      placement: "homepage_nav",
      browser: "firefox",
    }),
    null,
  );
  assert.equal(
    buildStoreClickEvent({
      href: "https://example.com/",
      placement: "homepage_final_cta",
    }),
    null,
  );
});

test("sends through gtag when Analytics is ready", () => {
  const calls: unknown[][] = [];
  const tracked = trackStoreClick(
    {
      href: CHROME_STORE_URL,
      placement: "homepage_nav",
      browser: "chrome",
    },
    {
      gtag: (...args: unknown[]) => calls.push(args),
    },
  );

  assert.equal(tracked, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "event");
  assert.equal(calls[0][1], "store_click");
});

test("queues the event without blocking when Analytics is not ready", () => {
  const analyticsWindow: { dataLayer?: unknown[] } = {};
  const tracked = trackStoreClick(
    {
      href: CHROME_STORE_URL,
      placement: "homepage_final_cta",
    },
    analyticsWindow,
  );

  assert.equal(tracked, true);
  assert.deepEqual(analyticsWindow.dataLayer, [
    [
      "event",
      "store_click",
      {
        store: "chrome_web_store",
        cta_placement: "homepage_final_cta",
        link_url: CHROME_STORE_URL,
        link_domain: "chromewebstore.google.com",
        detected_browser: "unknown",
      },
    ],
  ]);
});
