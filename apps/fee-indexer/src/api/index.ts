import { Hono } from "hono";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, sum } from "ponder";

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

  const clankerEth = BigInt(clankerEthResult?.total ?? "0");
  const clankerBnkrw = BigInt(clankerBnkrwResult?.total ?? "0");
  const hookEth = BigInt(hookEthResult?.total ?? "0");

  return c.json({
    clankerEth: clankerEth.toString(),
    clankerBnkrw: clankerBnkrw.toString(),
    hookEth: hookEth.toString(),
    totalEth: (clankerEth + hookEth).toString(),
    totalBnkrw: clankerBnkrw.toString(),
  });
});

export default app;
