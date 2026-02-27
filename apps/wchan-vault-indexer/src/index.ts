import { ponder } from "ponder:registry";
import { vaultSnapshot } from "../ponder.schema";

ponder.on("WCHANVault:Donate", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db
    .insert(vaultSnapshot)
    .values({
      id,
      eventType: "donate",
      sender: event.args.sender,
      totalAssets: event.args.totalAssets,
      totalShares: event.args.totalShares,
      wchanAmount: event.args.amount,
      wethAmount: null,
      penaltyAmount: null,
      burnedAmount: null,
      retainedAmount: null,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

ponder.on("WCHANVault:DonateReward", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db
    .insert(vaultSnapshot)
    .values({
      id,
      eventType: "donate_reward",
      sender: event.args.sender,
      totalAssets: event.args.totalAssets,
      totalShares: event.args.totalShares,
      wchanAmount: null,
      wethAmount: event.args.amount,
      penaltyAmount: null,
      burnedAmount: null,
      retainedAmount: null,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

ponder.on("WCHANVault:EarlyWithdrawPenalty", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db
    .insert(vaultSnapshot)
    .values({
      id,
      eventType: "penalty",
      sender: event.args.owner,
      totalAssets: event.args.totalAssets,
      totalShares: event.args.totalShares,
      wchanAmount: event.args.retainedAmount,
      wethAmount: null,
      penaltyAmount: event.args.penaltyAmount,
      burnedAmount: event.args.burnedAmount,
      retainedAmount: event.args.retainedAmount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});
