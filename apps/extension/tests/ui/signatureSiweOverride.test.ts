import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("unsafe SIWE signing requires the sticky-bar checkbox", async () => {
  const [implementation, decisionSummary, screen, popover] = await Promise.all([
    readFile(
      new URL(
        "../../src/components/SignatureConfirmation/SignatureRequestConfirmation.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../src/components/SignatureConfirmation/SignatureDecisionSummary.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../src/components/SignatureConfirmation/SignatureConfirmationScreen.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../src/components/shared/WarningAcknowledgementPopover.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    implementation,
    /allowUnsafeSiwe:\s*siweOverrideRequired &&\s*siweOverrideAcknowledged/u,
  );
  assert.match(
    implementation,
    /siweOverrideRequired && !siweOverrideAcknowledged/u,
  );
  assert.match(
    implementation,
    /<SignatureDecisionSummary[\s\S]*?unsafeSiweDecision=/u,
  );
  assert.match(popover, /<Popover[\s\S]*?placement="top-end"/u);
  assert.match(popover, /<Checkbox[\s\S]*?isChecked=\{isAcknowledged\}/u);
  assert.match(
    popover,
    /chakra-checkbox__control\[data-checked\][\s\S]*?accent\.highlight/u,
  );
  assert.doesNotMatch(decisionSummary, /Review required/u);
  assert.doesNotMatch(decisionSummary, /type "I understand"/u);
  assert.doesNotMatch(screen, /UnsafeSiweAcknowledgement|Confirmation phrase/u);
});
