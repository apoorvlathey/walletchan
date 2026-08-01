import assert from "node:assert/strict";
import test from "node:test";

import { encodeBatchCalls } from "../../src/chrome/batch/batchTxEncoding";
import {
  decodeErc7821Batch,
  looksLikeErc7821SelfBatch,
} from "../../src/lib/erc7821Decode";
import {
  extractExplorerTransactionHash,
  getExplorerSiteName,
  parseExplorerRpcTransaction,
  resolveExplorerTransactionPage,
} from "../../src/lib/explorerTransaction";
import type { NetworksInfo } from "../../src/types";

const HASH = `0x${"ab".repeat(32)}`;
const FROM = `0x${"11".repeat(20)}`;
const TO = `0x${"22".repeat(20)}`;

test("derives the explorer tab label from the page domain", () => {
  assert.equal(getExplorerSiteName("https://etherscan.io/tx/0x0"), "Etherscan");
  assert.equal(getExplorerSiteName("https://basescan.org/tx/0x0"), "BaseScan");
  assert.equal(
    getExplorerSiteName("https://sepolia.basescan.org/tx/0x0"),
    "BaseScan",
  );
  assert.equal(getExplorerSiteName("https://scan.my-rollup.example/tx/0x0"), "Scan");
  assert.equal(getExplorerSiteName("not a URL"), "Explorer");
});

test("extracts only exact transaction hashes from explorer paths", () => {
  assert.equal(extractExplorerTransactionHash(`/tx/${HASH}`), HASH);
  assert.equal(extractExplorerTransactionHash(`/network/tx/${HASH}/logs`), HASH);
  assert.equal(extractExplorerTransactionHash(`/address/${HASH}`), null);
  assert.equal(extractExplorerTransactionHash("/tx/0x1234"), null);
});

test("resolves built-in explorer origins to their configured chain", () => {
  const result = resolveExplorerTransactionPage(
    `https://etherscan.io/tx/${HASH}?utm_source=walletchan`,
    undefined,
  );
  assert.equal(result?.chain.chainId, 1);
  assert.equal(result?.txHash, HASH);
});

test("resolves custom explorer path prefixes and configured RPCs", () => {
  const networksInfo: NetworksInfo = {
    "Local rollup": {
      chainId: 42069,
      rpcUrl: "http://127.0.0.1:8545",
      explorer: "http://127.0.0.1:4000/explorer",
      isCustom: true,
    },
  };
  const result = resolveExplorerTransactionPage(
    `http://127.0.0.1:4000/explorer/tx/${HASH}`,
    networksInfo,
  );
  assert.equal(result?.chain.chainId, 42069);
  assert.equal(result?.chain.rpcUrl, "http://127.0.0.1:8545");
  assert.equal(
    resolveExplorerTransactionPage(
      `http://127.0.0.1:4000/not-explorer/tx/${HASH}`,
      networksInfo,
    ),
    null,
  );
});

test("accepts a bounded matching RPC transaction and normalizes addresses", () => {
  assert.deepEqual(
    parseExplorerRpcTransaction(
      { hash: HASH.toUpperCase().replace("0X", "0x"), from: FROM, to: TO, input: "0xAABB", value: "0x0" },
      HASH,
    ),
    { hash: HASH, from: FROM, to: TO, input: "0xaabb", value: "0x0" },
  );
});

test("rejects mismatched hashes and malformed RPC transaction fields", () => {
  assert.equal(
    parseExplorerRpcTransaction(
      { hash: `0x${"cd".repeat(32)}`, from: FROM, to: TO, input: "0x", value: "0x0" },
      HASH,
    ),
    null,
  );
  assert.equal(
    parseExplorerRpcTransaction(
      { hash: HASH, from: "0x1234", to: TO, input: "0x", value: "0x0" },
      HASH,
    ),
    null,
  );
});

test("reconstructs explorer ERC-7821 self-batches into their inner calls", () => {
  const calls = [
    { to: TO, value: "0x0", data: "0x12345678" },
    { to: `0x${"33".repeat(20)}`, value: "0x2a", data: "0x" },
  ];
  const encoded = encodeBatchCalls(calls, FROM);

  assert.equal(
    looksLikeErc7821SelfBatch({
      from: FROM,
      to: encoded.to,
      data: encoded.data,
    }),
    true,
  );
  assert.deepEqual(decodeErc7821Batch(encoded.data), calls);
});
