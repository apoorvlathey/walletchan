import { onchainTable, index } from "ponder";

export const vaultEvent = onchainTable(
  "vault_event",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    eventType: t.text().notNull(), // "deposit" | "withdraw"
    sender: t.hex().notNull(),
    owner: t.hex().notNull(),
    receiver: t.hex(), // only present on withdraw
    assets: t.bigint().notNull(),
    shares: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    ownerIdx: index().on(table.owner),
    timestampIdx: index().on(table.timestamp),
    eventTypeIdx: index().on(table.eventType),
  })
);

export const userBalance = onchainTable("user_balance", (t) => ({
  id: t.text().primaryKey(), // lowercased address
  shares: t.bigint().notNull(),
  lastUpdatedBlock: t.bigint().notNull(),
  lastUpdatedTimestamp: t.bigint().notNull(),
}));
