import assert from "node:assert/strict";
import test from "node:test";
import {
  BUNKER_CHAINS,
  classifyNonce,
  verdictFor,
} from "../app/bunker-mode/model";
import {
  isCheckableInput,
  scanChain,
  selectVerifiedReverseName,
} from "../app/bunker-mode/rpc";
const chain = BUNKER_CHAINS[0];
const address = "0x1111111111111111111111111111111111111111" as const;
test("reverse names prefer gwei then wei then ENS, with verified fallbacks", async () => {
  const candidates = ["alice.gwei", "alice.wei", "alice.eth"];
  const resolve = async (name: string) => ({ address, name });
  assert.equal(
    await selectVerifiedReverseName(candidates, address, resolve),
    "alice.gwei",
  );
  assert.equal(
    await selectVerifiedReverseName(
      [null, ...candidates.slice(1)],
      address,
      resolve,
    ),
    "alice.wei",
  );
  assert.equal(
    await selectVerifiedReverseName(
      [null, null, "alice.eth"],
      address,
      resolve,
    ),
    "alice.eth",
  );
  assert.equal(
    await selectVerifiedReverseName(candidates, address, async (name) => {
      if (name.endsWith(".gwei"))
        return { address: "0x2222222222222222222222222222222222222222", name };
      if (name.endsWith(".wei")) throw new Error("RPC unavailable");
      return resolve(name);
    }),
    "alice.eth",
  );
  assert.equal(
    await selectVerifiedReverseName(
      ["\u202ealice.gwei", null, "alice.eth"],
      address,
      resolve,
    ),
    "alice.eth",
  );
});
test("only complete all-zero coverage can produce a clean card", () => {
  const clean = BUNKER_CHAINS.map((c) => classifyNonce(c, "0x0", "0x"));
  assert.equal(verdictFor(clean), "clean");
  assert.equal(verdictFor(clean.slice(1)), "incomplete");
  assert.equal(
    verdictFor([{ ...clean[0], status: "error" }, ...clean.slice(1)]),
    "incomplete",
  );
  assert.equal(
    verdictFor([{ ...clean[0], status: "active", nonce: "1" }]),
    "active",
  );  const contract = [classifyNonce(BUNKER_CHAINS[0], "0x1", "0x6000"), ...clean.slice(1)];
  assert.equal(verdictFor(contract), "contract");
  assert.equal(
    verdictFor([...contract.slice(0, -1), { ...clean[1], status: "error" }]),
    "incomplete",
  );
});
test("contract nonces never establish signer exposure; EIP-7702 delegations do", () => {
  assert.equal(classifyNonce(chain, "0x1", "0x6000").status, "contract");
  assert.equal(classifyNonce(chain, "0x1", "0x").status, "active");
  assert.equal(
    classifyNonce(chain, "0x0", `0xef0100${"11".repeat(20)}`).status,
    "active",
  );
  assert.equal(
    classifyNonce(chain, "0xffffffffffffffff", "0x").nonce,
    "18446744073709551615",
  );
  for (const nonce of [null, "", "0x", "garbage", -1, "0x00"])
    assert.throws(() => classifyNonce(chain, nonce, "0x"));
  assert.throws(() => classifyNonce(chain, "0x0", null));
});
test("batch replies match by ID and wrong-chain responses fail closed", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json([
        { id: 3, result: "0x" },
        { id: 2, result: "0x2" },
        { id: 1, result: `0x${chain.id.toString(16)}` },
      ]);
    assert.equal(
      (await scanChain(chain, address, new AbortController().signal)).status,
      "active",
    );
    globalThis.fetch = async () =>
      Response.json([
        { id: 3, result: "0x" },
        { id: 2, result: "0x0" },
        { id: 1, result: "0x999" },
      ]);
    assert.equal(
      (await scanChain(chain, address, new AbortController().signal)).status,
      "error",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("batch rejection retries individual methods and RPC errors cannot become zero", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      return Response.json(
        Array.isArray(body)
          ? { error: { code: -32600 } }
          : {
              id: body.id,
              result:
                body.id === 1
                  ? `0x${chain.id.toString(16)}`
                  : body.id === 2
                    ? "0x0"
                    : "0x",
            },
      );
    };
    assert.equal(
      (await scanChain(chain, address, new AbortController().signal)).status,
      "clean",
    );
    globalThis.fetch = async () =>
      Response.json([
        { id: 1, result: `0x${chain.id.toString(16)}` },
        { id: 2, error: { code: -32000 } },
        { id: 3, result: "0x" },
      ]);
    assert.equal(
      (await scanChain(chain, address, new AbortController().signal)).status,
      "error",
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(scanChain(chain, address, controller.signal), {
      name: "AbortError",
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("paste checks accept complete addresses and names, and reject partial or malformed input", () => {
  for (const value of [
    address,
    `  ${address}  `,
    "apoorv.gwei",
    "alice.wei",
    "vitalik.eth",
    "sub.alice.eth",
  ]) {
    assert.equal(isCheckableInput(value), true, value);
  }
  for (const value of [
    "",
    "0x1234",
    "alice",
    ".eth",
    "alice..eth",
    "alice.eth.",
    "https://alice.eth",
    "alice eth",
    "a".repeat(256) + ".eth",
  ]) {
    assert.equal(isCheckableInput(value), false, value);
  }
});

test("trophies rank only positive signer nonces with bigint precision and omit missing ranks", async () => {
  const { topNonceChains, cardCopy } = await import("../app/bunker-mode/model");
  const results = [
    classifyNonce(BUNKER_CHAINS[0], "0x20000000000001", "0x"),
    classifyNonce(BUNKER_CHAINS[1], "0x20000000000002", "0x"),
    classifyNonce(BUNKER_CHAINS[2], "0x1", "0x6000"),
    classifyNonce(BUNKER_CHAINS[3], "0x0", "0x"),
    classifyNonce(BUNKER_CHAINS[4], "0x5", "0x"),
    classifyNonce(BUNKER_CHAINS[5], "0x3", "0x"),
  ];
  assert.deepEqual(topNonceChains(results).map((r) => r.chain.id),
    [BUNKER_CHAINS[1].id, BUNKER_CHAINS[0].id, BUNKER_CHAINS[4].id]);
  assert.equal(topNonceChains(results.slice(0, 1)).length, 1);
  assert.equal(topNonceChains(results.slice(0, 2)).length, 2);
  assert.equal(topNonceChains(results.slice(2, 4)).length, 0);
  assert.equal(cardCopy("contract", [results[2]]).title, "NO PRIVATE KEY");
  assert.equal(cardCopy("incomplete", [{ chain, status: "error" }]).title, "SCAN UNFINISHED");
});
