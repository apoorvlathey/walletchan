import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { graphql } from "ponder";
import { desc, eq, gte, count } from "ponder";

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

// GET /coins/stream - SSE stream of new coin launches
app.get("/coins/stream", (c) => {
  const sinceParam = c.req.query("since");
  let cursor = sinceParam ? BigInt(sinceParam) : 0n;
  const seen = new Set<string>();
  let eventId = 0;

  return streamSSE(c, async (stream) => {
    // Send initial batch if no cursor provided
    if (!sinceParam) {
      try {
        const latest = await db
          .select()
          .from(schema.coinLaunch)
          .orderBy(desc(schema.coinLaunch.timestamp))
          .limit(10);

        for (const coin of latest.reverse()) {
          seen.add(coin.id);
          await stream.writeSSE({
            data: JSON.stringify(replaceBigInts(coin)),
            event: "coin",
            id: String(++eventId),
          });
        }
        if (latest.length > 0) cursor = latest[0].timestamp;
      } catch (e) {
        console.error("SSE initial batch error:", e instanceof Error ? e.message : e);
      }
    }

    // Poll for new coins every 2s
    let consecutiveErrors = 0;
    while (true) {
      await stream.sleep(2000);

      try {
        const rows = await db
          .select()
          .from(schema.coinLaunch)
          .where(gte(schema.coinLaunch.timestamp, cursor))
          .orderBy(schema.coinLaunch.timestamp)
          .limit(50);

        consecutiveErrors = 0;

        for (const coin of rows) {
          if (seen.has(coin.id)) continue;
          seen.add(coin.id);
          await stream.writeSSE({
            data: JSON.stringify(replaceBigInts(coin)),
            event: "coin",
            id: String(++eventId),
          });
          if (coin.timestamp > cursor) cursor = coin.timestamp;
        }
      } catch (e) {
        consecutiveErrors++;
        console.error(
          `SSE poll error (attempt ${consecutiveErrors}):`,
          e instanceof Error ? e.message : e
        );
        // Back off on repeated failures, close stream after too many
        if (consecutiveErrors >= 10) {
          console.error("SSE stream: too many consecutive DB errors, closing stream");
          break;
        }
        // Exponential backoff: wait longer on repeated failures
        await stream.sleep(Math.min(consecutiveErrors * 2000, 10000));
      }
    }
  });
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
