import { Hono } from "hono";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { desc, eq, sum } from "ponder";

const WETH = "0x4200000000000000000000000000000000000006" as `0x${string}`;
const BNKRW = "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07" as `0x${string}`;

const app = new Hono();

// GET /stats — aggregated claimed totals
app.get("/stats", async (c) => {
  const [clankerEthResult] = await db
    .select({ total: sum(schema.clankerClaim.amount) })
    .from(schema.clankerClaim)
    .where(eq(schema.clankerClaim.token, WETH));

  const [clankerBnkrwResult] = await db
    .select({ total: sum(schema.clankerClaim.amount) })
    .from(schema.clankerClaim)
    .where(eq(schema.clankerClaim.token, BNKRW));

  const [hookEthResult] = await db
    .select({ total: sum(schema.hookClaim.amount) })
    .from(schema.hookClaim);

  const [v4EthResult] = await db
    .select({ total: sum(schema.v4Claim.ethAmount) })
    .from(schema.v4Claim);

  const [v4WchanResult] = await db
    .select({ total: sum(schema.v4Claim.wchanAmount) })
    .from(schema.v4Claim);

  const clankerEth = BigInt(clankerEthResult?.total ?? "0");
  const clankerBnkrw = BigInt(clankerBnkrwResult?.total ?? "0");
  const hookEth = BigInt(hookEthResult?.total ?? "0");
  const v4Eth = BigInt(v4EthResult?.total ?? "0");
  const v4Wchan = BigInt(v4WchanResult?.total ?? "0");

  return c.json({
    clankerEth: clankerEth.toString(),
    clankerBnkrw: clankerBnkrw.toString(),
    hookEth: hookEth.toString(),
    v4Eth: v4Eth.toString(),
    v4Wchan: v4Wchan.toString(),
    totalEth: (clankerEth + hookEth + v4Eth).toString(),
    totalBnkrw: clankerBnkrw.toString(),
    totalWchan: v4Wchan.toString(),
  });
});

// GET /claims — individual claim events, newest first
app.get("/claims", async (c) => {
  const clankerClaims = await db
    .select()
    .from(schema.clankerClaim)
    .orderBy(desc(schema.clankerClaim.timestamp));

  const hookClaims = await db
    .select()
    .from(schema.hookClaim)
    .orderBy(desc(schema.hookClaim.timestamp));

  const v4Claims = await db
    .select()
    .from(schema.v4Claim)
    .orderBy(desc(schema.v4Claim.timestamp));

  const combined = [
    ...clankerClaims.map((c) => ({
      source: "clanker" as const,
      token: c.token.toLowerCase() === WETH.toLowerCase() ? "WETH" : "BNKRW",
      amount: c.amount.toString(),
      timestamp: Number(c.timestamp),
      transactionHash: c.transactionHash,
    })),
    ...hookClaims.map((c) => ({
      source: "hook" as const,
      token: "WETH" as const,
      amount: c.amount.toString(),
      timestamp: Number(c.timestamp),
      transactionHash: c.transactionHash,
    })),
    // Each V4 claim produces two entries: one for ETH, one for WCHAN
    ...v4Claims.flatMap((c) => {
      const entries: {
        source: "v4";
        token: "WETH" | "WCHAN";
        amount: string;
        timestamp: number;
        transactionHash: `0x${string}`;
      }[] = [];
      if (c.ethAmount > 0n) {
        entries.push({
          source: "v4",
          token: "WETH",
          amount: c.ethAmount.toString(),
          timestamp: Number(c.timestamp),
          transactionHash: c.transactionHash,
        });
      }
      if (c.wchanAmount > 0n) {
        entries.push({
          source: "v4",
          token: "WCHAN",
          amount: c.wchanAmount.toString(),
          timestamp: Number(c.timestamp),
          transactionHash: c.transactionHash,
        });
      }
      return entries;
    }),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return c.json(combined);
});

export default app;
