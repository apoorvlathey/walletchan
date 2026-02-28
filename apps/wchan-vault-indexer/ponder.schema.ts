import { onchainTable, index } from "ponder";

export const userBalance = onchainTable("user_balance", (t) => ({
  id: t.text().primaryKey(), // lowercased address
  shares: t.bigint().notNull(),
  lastUpdatedBlock: t.bigint().notNull(),
  lastUpdatedTimestamp: t.bigint().notNull(),
}));

export const vaultSnapshot = onchainTable(
  "vault_snapshot",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    eventType: t.text().notNull(), // "deposit" | "withdraw" | "donate" | "donate_reward" | "penalty"
    sender: t.hex().notNull(),
    totalAssets: t.bigint().notNull(),
    totalShares: t.bigint().notNull(),
    wchanAmount: t.bigint(), // Donate: amount; Penalty: retainedAmount
    wethAmount: t.bigint(), // DonateReward: amount
    penaltyAmount: t.bigint(),
    burnedAmount: t.bigint(),
    retainedAmount: t.bigint(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    timestampIdx: index().on(table.timestamp),
    eventTypeIdx: index().on(table.eventType),
  })
);
