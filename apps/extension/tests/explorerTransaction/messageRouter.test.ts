import assert from "node:assert/strict";
import test from "node:test";

import { explorerTransactionMessagePolicy } from "../../src/chrome/explorerTransaction/messageRouter";

const EXTENSION_ROOT = "chrome-extension://walletchan/";

function sender(url: string, frameId: number): chrome.runtime.MessageSender {
  return { url, frameId } as chrome.runtime.MessageSender;
}

test("recognizes only the exact explorer extension document", () => {
  assert.equal(
    explorerTransactionMessagePolicy.isExplorerExtensionFrame(
      sender(`${EXTENSION_ROOT}explorer.html?page=https%3A%2F%2Fetherscan.io`, 3),
      EXTENSION_ROOT,
    ),
    true,
  );
  assert.equal(
    explorerTransactionMessagePolicy.isExplorerExtensionFrame(
      sender(`${EXTENSION_ROOT}explorer.html`, 0),
      EXTENSION_ROOT,
    ),
    true,
  );
  assert.equal(
    explorerTransactionMessagePolicy.isExplorerExtensionFrame(
      sender(`${EXTENSION_ROOT}index.html`, 3),
      EXTENSION_ROOT,
    ),
    false,
  );
  assert.equal(
    explorerTransactionMessagePolicy.isExplorerExtensionFrame(
      sender("https://attacker.example/explorer.html", 3),
      EXTENSION_ROOT,
    ),
    false,
  );
});
