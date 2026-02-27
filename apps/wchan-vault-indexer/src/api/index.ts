import { Hono } from "hono";
import { db } from "ponder:api";
import schema from "ponder:schema";
import { graphql } from "ponder";
import { desc, eq, gte, lte, sum, count, asc } from "ponder";

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

const PRECISION = 10n ** 18n;

function computeSharePrice(totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) return PRECISION;
  return (totalAssets * PRECISION) / totalShares;
}

const app = new Hono();

app.use("/graphql", graphql({ db, schema }));

// GET /apy?window=7d|30d|all
app.get("/apy", async (c) => {
  const window = c.req.query("window") || "7d";

  let windowSeconds: number;
  switch (window) {
    case "7d":
      windowSeconds = 7 * 86400;
      break;
    case "30d":
      windowSeconds = 30 * 86400;
      break;
    case "all":
      windowSeconds = 0; // no filter
      break;
    default:
      windowSeconds = 7 * 86400;
  }

  // Get latest snapshot for current share price
  const [latest] = await db
    .select()
    .from(schema.vaultSnapshot)
    .orderBy(desc(schema.vaultSnapshot.timestamp))
    .limit(1);

  if (!latest) {
    return c.json({
      wchanAPY: 0,
      sharePrice: "0",
      totalStaked: "0",
      window,
      wethDistributed: "0",
    });
  }

  const latestSharePrice = computeSharePrice(
    latest.totalAssets,
    latest.totalShares
  );

  // For APY we need the share price BEFORE the window started.
  // Events record post-action state, so the earliest event in the window
  // already has the bumped price. We need the last snapshot BEFORE the cutoff.
  let wchanAPY = 0;
  const now = BigInt(Math.floor(Date.now() / 1000));

  let baselineSharePrice: bigint;
  let baselineTimestamp: bigint;

  if (windowSeconds > 0) {
    const cutoff = now - BigInt(windowSeconds);

    // Get the last snapshot BEFORE the window to get the pre-window share price
    const [preWindow] = await db
      .select()
      .from(schema.vaultSnapshot)
      .where(lte(schema.vaultSnapshot.timestamp, cutoff))
      .orderBy(desc(schema.vaultSnapshot.timestamp))
      .limit(1);

    if (preWindow) {
      baselineSharePrice = computeSharePrice(preWindow.totalAssets, preWindow.totalShares);
      baselineTimestamp = preWindow.timestamp;
    } else {
      // All events are within the window — use initial ERC4626 share price 1.0
      const [first] = await db
        .select()
        .from(schema.vaultSnapshot)
        .orderBy(asc(schema.vaultSnapshot.timestamp))
        .limit(1);
      baselineSharePrice = PRECISION; // 1e18
      baselineTimestamp = first?.timestamp ?? now;
    }
  } else {
    // "all" window — always compare against initial share price
    const [first] = await db
      .select()
      .from(schema.vaultSnapshot)
      .orderBy(asc(schema.vaultSnapshot.timestamp))
      .limit(1);
    baselineSharePrice = PRECISION;
    baselineTimestamp = first?.timestamp ?? now;
  }

  let daysBetween = 0;
  if (baselineSharePrice > 0n) {
    daysBetween = Number(now - baselineTimestamp) / 86400;
    if (daysBetween > 0) {
      const priceRatio = Number(latestSharePrice) / Number(baselineSharePrice);
      wchanAPY = (priceRatio - 1) * (365 / daysBetween) * 100;
    }
  }

  // Sum WETH distributed in window
  let wethQuery;
  if (windowSeconds > 0) {
    const cutoff = latest.timestamp - BigInt(windowSeconds);
    wethQuery = db
      .select({ total: sum(schema.vaultSnapshot.wethAmount) })
      .from(schema.vaultSnapshot)
      .where(eq(schema.vaultSnapshot.eventType, "donate_reward"))
      .where(gte(schema.vaultSnapshot.timestamp, cutoff));
  } else {
    wethQuery = db
      .select({ total: sum(schema.vaultSnapshot.wethAmount) })
      .from(schema.vaultSnapshot)
      .where(eq(schema.vaultSnapshot.eventType, "donate_reward"));
  }

  const [wethResult] = await wethQuery;

  return c.json({
    wchanAPY: Math.round(wchanAPY * 100) / 100,
    sharePrice: latestSharePrice.toString(),
    totalStaked: latest.totalAssets.toString(),
    totalShares: latest.totalShares.toString(),
    window,
    secondsElapsed: Number(now - baselineTimestamp),
    wethDistributed: BigInt(wethResult?.total ?? "0").toString(),
  });
});

// GET /apy/history?interval=1d&from=...&to=...
app.get("/apy/history", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");

  let query = db
    .select()
    .from(schema.vaultSnapshot)
    .orderBy(asc(schema.vaultSnapshot.timestamp));

  if (from) {
    query = db
      .select()
      .from(schema.vaultSnapshot)
      .where(gte(schema.vaultSnapshot.timestamp, BigInt(from)))
      .orderBy(asc(schema.vaultSnapshot.timestamp));
  }

  if (from && to) {
    query = db
      .select()
      .from(schema.vaultSnapshot)
      .where(gte(schema.vaultSnapshot.timestamp, BigInt(from)))
      .where(lte(schema.vaultSnapshot.timestamp, BigInt(to)))
      .orderBy(asc(schema.vaultSnapshot.timestamp));
  }

  const snapshots = await query.limit(1000);

  const history = snapshots.map((s) => ({
    timestamp: Number(s.timestamp),
    sharePrice: computeSharePrice(s.totalAssets, s.totalShares).toString(),
    totalAssets: s.totalAssets.toString(),
    totalShares: s.totalShares.toString(),
    eventType: s.eventType,
  }));

  return c.json(history);
});

// GET /snapshots — raw events, paginated
app.get("/snapshots", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Number(c.req.query("offset") || 0);
  const type = c.req.query("type");

  let query;
  if (type && ["donate", "donate_reward", "penalty"].includes(type)) {
    query = db
      .select()
      .from(schema.vaultSnapshot)
      .where(eq(schema.vaultSnapshot.eventType, type))
      .orderBy(desc(schema.vaultSnapshot.timestamp))
      .limit(limit)
      .offset(offset);
  } else {
    query = db
      .select()
      .from(schema.vaultSnapshot)
      .orderBy(desc(schema.vaultSnapshot.timestamp))
      .limit(limit)
      .offset(offset);
  }

  const results = await query;
  return c.json(replaceBigInts(results));
});

// GET /stats — aggregate stats
app.get("/stats", async (c) => {
  const [totalEvents] = await db
    .select({ total: count() })
    .from(schema.vaultSnapshot);

  const [donateCount] = await db
    .select({ total: count() })
    .from(schema.vaultSnapshot)
    .where(eq(schema.vaultSnapshot.eventType, "donate"));

  const [rewardCount] = await db
    .select({ total: count() })
    .from(schema.vaultSnapshot)
    .where(eq(schema.vaultSnapshot.eventType, "donate_reward"));

  const [penaltyCount] = await db
    .select({ total: count() })
    .from(schema.vaultSnapshot)
    .where(eq(schema.vaultSnapshot.eventType, "penalty"));

  const [totalWchanDonated] = await db
    .select({ total: sum(schema.vaultSnapshot.wchanAmount) })
    .from(schema.vaultSnapshot)
    .where(eq(schema.vaultSnapshot.eventType, "donate"));

  const [totalWethDistributed] = await db
    .select({ total: sum(schema.vaultSnapshot.wethAmount) })
    .from(schema.vaultSnapshot)
    .where(eq(schema.vaultSnapshot.eventType, "donate_reward"));

  // Latest share price
  const [latest] = await db
    .select()
    .from(schema.vaultSnapshot)
    .orderBy(desc(schema.vaultSnapshot.timestamp))
    .limit(1);

  const sharePrice = latest
    ? computeSharePrice(latest.totalAssets, latest.totalShares).toString()
    : "0";

  return c.json({
    totalEvents: totalEvents?.total ?? 0,
    donateEvents: donateCount?.total ?? 0,
    donateRewardEvents: rewardCount?.total ?? 0,
    penaltyEvents: penaltyCount?.total ?? 0,
    totalWchanDonated: BigInt(totalWchanDonated?.total ?? "0").toString(),
    totalWethDistributed: BigInt(
      totalWethDistributed?.total ?? "0"
    ).toString(),
    currentSharePrice: sharePrice,
    totalStaked: latest?.totalAssets.toString() ?? "0",
    totalShares: latest?.totalShares.toString() ?? "0",
  });
});

export default app;
