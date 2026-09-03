import assert from "node:assert/strict";
import test from "node:test";

import { RpcError } from "../src/rpcTypes.js";
import { handleRpcRequest } from "../src/rpcHandler.js";
import { normalizeSendTransactionInput } from "../src/transactionNormalization.js";

test("promotes Foundry input calldata to wallet-facing data", () => {
  const transaction = {
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    input: "0x1234",
    value: "0x0",
  };

  assert.deepEqual(normalizeSendTransactionInput(transaction), {
    from: transaction.from,
    to: transaction.to,
    data: transaction.input,
    value: transaction.value,
  });
});

test("preserves data and removes a matching input alias", () => {
  assert.deepEqual(
    normalizeSendTransactionInput({ data: "0xabcd", input: "0xabcd" }),
    { data: "0xabcd" },
  );
});

test("rejects conflicting calldata aliases", () => {
  assert.throws(
    () => normalizeSendTransactionInput({ data: "0xabcd", input: "0x1234" }),
    (error) => error instanceof RpcError && error.code === -32602,
  );
});

test("rejects a non-string input alias", () => {
  assert.throws(
    () => normalizeSendTransactionInput({ input: 1234 }),
    (error) => error instanceof RpcError && error.code === -32602,
  );
});

test("eth_sendTransaction forwards normalized calldata to the wallet", async () => {
  const from = "0x0000000000000000000000000000000000000001";
  const forwarded: unknown[][] = [];
  const chain = { chainId: 1, name: "Ethereum", rpcUrl: "http://upstream.invalid" };
  const response = await handleRpcRequest(
    {
      id: 1,
      method: "eth_sendTransaction",
      params: [{ from, to: from, input: "0x1234", value: "0x0" }],
    },
    {
      bundleChains: new Map(),
      chains: [chain],
      getActiveChain: () => chain,
      includeBatching: false,
      localBundles: new Map(),
      sequentialReceiptTimeoutMs: 1_000,
      setActiveChain: () => undefined,
      upstreamTimeoutMs: 1_000,
      wallet: {
        connected: true,
        getAccounts: () => [from],
        request: async (chainId, method, params) => {
          forwarded.push([chainId, method, params]);
          return "0xtransactionhash";
        },
      },
    } as never,
  );

  assert.deepEqual(response, {
    jsonrpc: "2.0",
    id: 1,
    result: "0xtransactionhash",
  });
  assert.deepEqual(forwarded, [
    [
      1,
      "eth_sendTransaction",
      [{ from, to: from, data: "0x1234", value: "0x0" }],
    ],
  ]);
});
