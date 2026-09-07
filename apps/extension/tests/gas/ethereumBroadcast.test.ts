import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createPublicClient, http, parseTransaction } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { estimateFeeTiers } from "../../src/chrome/gas/feeEstimator";
import { broadcastSerializedTransaction } from "../../src/chrome/localSigning/transactionBroadcast";
import { recommendReplacementFees } from "../../src/chrome/transactions/replacementPolicy";

// Opt-in because Anvil is not a JS workspace dependency. Never contacts mainnet.
test("low Ethereum fees are accepted, replaced, and mined on a local EVM", {
  skip: process.env.WALLETCHAN_TEST_ANVIL !== "1",
  timeout: 30_000,
}, async () => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const process = spawn("anvil", ["--host", "127.0.0.1", "--port", String(port),
    "--chain-id", "1", "--no-mining", "--base-fee", "40000000", "--silent"],
    { stdio: "ignore" });
  let spawnError: Error | undefined;
  process.on("error", error => { spawnError = error; });
  const client = createPublicClient({ chain: mainnet,
    transport: http(`http://127.0.0.1:${port}`, { retryCount: 0, timeout: 1_000 }) });
  const rpc = (method: string, params: unknown[] = []) => client.request({ method, params } as any);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (spawnError) throw spawnError;
      try { await client.getChainId(); ready = true; break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, "local node started");
    // Fixture identities only. No user's wallet, device, or API credentials.
    const accounts = [
      privateKeyToAccount(`0x${"01".repeat(32)}`),
      mnemonicToAccount("test test test test test test test test test test test junk"),
    ];
    const fees = await estimateFeeTiers({
      getBlock: () => client.getBlock({ blockTag: "latest" }),
      request: async () => ({ reward: Array.from({ length: 10 }, () => ["0x2"]) }),
    } as any, 1);
    assert.ok(fees);
    for (const account of accounts) {
      await rpc("anvil_setBalance", [account.address, "0x56bc75e2d63100000"]);
      let nonce = 0;
      for (const tier of Object.values(fees.tiers)) {
        const serialized = await account.signTransaction({ chainId: 1, type: "eip1559",
          to: account.address, value: 0n, gas: 21_000n, nonce: nonce++, ...tier });
        assert.equal(parseTransaction(serialized).maxPriorityFeePerGas, tier.maxPriorityFeePerGas);
        const sent = await broadcastSerializedTransaction(client as any, serialized,
          { chainId: 1, supportsSyncSend: false });
        assert.notEqual(sent.broadcastUncertain, true);
        await rpc("evm_mine");
        assert.equal((await client.getTransactionReceipt({ hash: sent.txHash })).status, "success");
      }
      // Replace a pending low-tip tx with the production bump before mining.
      const source = { chainId: 1, type: "eip1559" as const, to: account.address,
        value: 0n, gas: 21_000n, nonce, ...fees.tiers.standard };
      const originalHash = await client.sendRawTransaction({ serializedTransaction: await account.signTransaction(source) });
      const bump = recommendReplacementFees(source as any);
      const replacement = await account.signTransaction({ ...source,
        maxFeePerGas: BigInt(bump.maxFeePerGas), maxPriorityFeePerGas: BigInt(bump.maxPriorityFeePerGas) });
      const replaced = await broadcastSerializedTransaction(client as any, replacement,
        { chainId: 1, supportsSyncSend: false });
      assert.notEqual(replaced.broadcastUncertain, true);
      assert.notEqual(replaced.txHash, originalHash);
      await rpc("evm_mine");
      assert.equal((await client.getTransactionReceipt({ hash: replaced.txHash })).status, "success");
      await assert.rejects(client.getTransactionReceipt({ hash: originalHash }));
    }
  } finally {
    if (process.exitCode === null && !spawnError) {
      const exited = once(process, "exit");
      process.kill("SIGTERM");
      await exited;
    }
  }
});
