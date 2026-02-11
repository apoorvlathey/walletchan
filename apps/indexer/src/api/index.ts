import { Hono } from "hono";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { graphql } from "ponder";
import { desc, eq, count } from "ponder";

// Helper to serialize BigInt values in JSON responses
function replaceBigInts(obj: unknown): unknown {
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(replaceBigInts);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, replaceBigInts(v)])
    );
  }
  return obj;
}

const app = new Hono();

// GraphQL endpoint
app.use("/graphql", graphql({ db, schema }));

// GET /coins - List all coins (paginated)
app.get("/coins", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);

  const results = await db
    .select()
    .from(schema.coinLaunch)
    .orderBy(desc(schema.coinLaunch.timestamp))
    .limit(limit)
    .offset(offset);

  return c.json(replaceBigInts(results));
});

// GET /coins/creator/:address - Get coins by creator (must be before /coins/:address)
app.get("/coins/creator/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);

  const results = await db
    .select()
    .from(schema.coinLaunch)
    .where(eq(schema.coinLaunch.creatorAddress, address))
    .orderBy(desc(schema.coinLaunch.timestamp))
    .limit(limit)
    .offset(offset);

  return c.json(replaceBigInts(results));
});

// GET /coins/:address - Get single coin by address
app.get("/coins/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const results = await db
    .select()
    .from(schema.coinLaunch)
    .where(eq(schema.coinLaunch.id, address))
    .limit(1);

  if (results.length === 0) {
    return c.json({ error: "Coin not found" }, 404);
  }

  return c.json(replaceBigInts(results[0]));
});

// GET /stats - Total count + latest coin
app.get("/stats", async (c) => {
  const [countResult] = await db
    .select({ total: count() })
    .from(schema.coinLaunch);

  const [latest] = await db
    .select()
    .from(schema.coinLaunch)
    .orderBy(desc(schema.coinLaunch.timestamp))
    .limit(1);

  return c.json(
    replaceBigInts({
      totalCoins: countResult?.total ?? 0,
      latestCoin: latest ?? null,
    })
  );
});

export default app;
