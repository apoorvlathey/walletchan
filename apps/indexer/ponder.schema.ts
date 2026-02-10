import { onchainTable, index } from "ponder";

export const coinLaunch = onchainTable(
  "coin_launch",
  (t) => ({
    id: t.text().primaryKey(),
    coinAddress: t.hex().notNull(),
    name: t.text(),
    symbol: t.text(),
    tokenURI: t.text(),
    tweetUrl: t.text(),
    creatorAddress: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    creatorIdx: index().on(table.creatorAddress),
    timestampIdx: index().on(table.timestamp),
  })
);
