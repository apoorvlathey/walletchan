import { onchainTable, index } from "ponder";

export const clankerClaim = onchainTable(
  "clanker_claim",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    token: t.hex().notNull(), // WETH or BNKRW address
    amount: t.bigint().notNull(), // amountClaimed
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    tokenIdx: index().on(table.token),
    timestampIdx: index().on(table.timestamp),
  })
);

export const hookClaim = onchainTable(
  "hook_claim",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    dev: t.hex().notNull(), // dev address
    amount: t.bigint().notNull(), // WETH amount
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    timestampIdx: index().on(table.timestamp),
  })
);
