import { ponder } from "ponder:registry";
import { vaultEvent, userBalance } from "../ponder.schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// --- Deposit event: store rich event data ---
ponder.on("sBNKRWVault:Deposit", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(vaultEvent)
    .values({
      id,
      eventType: "deposit",
      sender: event.args.sender,
      owner: event.args.owner,
      receiver: null,
      assets: event.args.assets,
      shares: event.args.shares,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

// --- Withdraw event: store rich event data ---
ponder.on("sBNKRWVault:Withdraw", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(vaultEvent)
    .values({
      id,
      eventType: "withdraw",
      sender: event.args.sender,
      owner: event.args.owner,
      receiver: event.args.receiver,
      assets: event.args.assets,
      shares: event.args.shares,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

// --- Transfer event: update user balances ---
// Deposit emits Transfer(0x0 → owner), Withdraw emits Transfer(owner → 0x0).
// Direct sBNKRW transfers between users are also captured here.
ponder.on("sBNKRWVault:Transfer", async ({ event, context }) => {
  const from = event.args.from.toLowerCase();
  const to = event.args.to.toLowerCase();
  const value = event.args.value;

  // Decrement sender balance (skip mint from zero address)
  if (from !== ZERO_ADDRESS) {
    const existing = await context.db.find(userBalance, { id: from });
    const currentShares = existing?.shares ?? 0n;
    const newShares = currentShares - value;

    await context.db
      .insert(userBalance)
      .values({
        id: from,
        shares: newShares,
        lastUpdatedBlock: event.block.number,
        lastUpdatedTimestamp: event.block.timestamp,
      })
      .onConflictDoUpdate({
        shares: newShares,
        lastUpdatedBlock: event.block.number,
        lastUpdatedTimestamp: event.block.timestamp,
      });
  }

  // Increment receiver balance (skip burn to zero address)
  if (to !== ZERO_ADDRESS) {
    const existing = await context.db.find(userBalance, { id: to });
    const currentShares = existing?.shares ?? 0n;
    const newShares = currentShares + value;

    await context.db
      .insert(userBalance)
      .values({
        id: to,
        shares: newShares,
        lastUpdatedBlock: event.block.number,
        lastUpdatedTimestamp: event.block.timestamp,
      })
      .onConflictDoUpdate({
        shares: newShares,
        lastUpdatedBlock: event.block.number,
        lastUpdatedTimestamp: event.block.timestamp,
      });
  }
});
