import { Hono } from "hono";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { graphql } from "ponder";
import { desc, eq, gt, count, sum } from "ponder";

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

// GET /balances/:address - Single user's staked balance
app.get("/balances/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const results = await db
    .select()
    .from(schema.userBalance)
    .where(eq(schema.userBalance.id, address))
    .limit(1);

  if (results.length === 0) {
    return c.json({ id: address, shares: "0" });
  }

  return c.json(replaceBigInts(results[0]));
});

// GET /balances - All users with non-zero balance (paginated, ordered by shares desc)
app.get("/balances", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);

  const results = await db
    .select()
    .from(schema.userBalance)
    .where(gt(schema.userBalance.shares, 0n))
    .orderBy(desc(schema.userBalance.shares))
    .limit(limit)
    .offset(offset);

  return c.json(replaceBigInts(results));
});

// GET /events/:address - User's deposit/withdraw history
app.get("/events/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);
  const type = c.req.query("type"); // optional: "deposit" | "withdraw"

  let query = db
    .select()
    .from(schema.vaultEvent)
    .where(eq(schema.vaultEvent.owner, address))
    .orderBy(desc(schema.vaultEvent.timestamp))
    .limit(limit)
    .offset(offset);

  // If type filter is provided, we need to add another where clause
  if (type === "deposit" || type === "withdraw") {
    query = db
      .select()
      .from(schema.vaultEvent)
      .where(eq(schema.vaultEvent.owner, address))
      .where(eq(schema.vaultEvent.eventType, type))
      .orderBy(desc(schema.vaultEvent.timestamp))
      .limit(limit)
      .offset(offset);
  }

  const results = await query;
  return c.json(replaceBigInts(results));
});

// GET /events - Paginated deposit/withdraw history
app.get("/events", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);
  const type = c.req.query("type"); // optional: "deposit" | "withdraw"

  let query = db
    .select()
    .from(schema.vaultEvent)
    .orderBy(desc(schema.vaultEvent.timestamp))
    .limit(limit)
    .offset(offset);

  if (type === "deposit" || type === "withdraw") {
    query = db
      .select()
      .from(schema.vaultEvent)
      .where(eq(schema.vaultEvent.eventType, type))
      .orderBy(desc(schema.vaultEvent.timestamp))
      .limit(limit)
      .offset(offset);
  }

  const results = await query;
  return c.json(replaceBigInts(results));
});

// GET /stats - Unique stakers, total shares, total events
app.get("/stats", async (c) => {
  const [stakersResult] = await db
    .select({ total: count() })
    .from(schema.userBalance)
    .where(gt(schema.userBalance.shares, 0n));

  const [sharesResult] = await db
    .select({ total: sum(schema.userBalance.shares) })
    .from(schema.userBalance)
    .where(gt(schema.userBalance.shares, 0n));

  const [eventsResult] = await db
    .select({ total: count() })
    .from(schema.vaultEvent);

  return c.json(
    replaceBigInts({
      uniqueStakers: stakersResult?.total ?? 0,
      totalShares: sharesResult?.total ?? "0",
      totalEvents: eventsResult?.total ?? 0,
    })
  );
});

export default app;
