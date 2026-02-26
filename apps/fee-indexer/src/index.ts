import { ponder } from "ponder:registry";
import { clankerClaim, hookClaim } from "../ponder.schema";

const CLANKER_FEE_OWNER = "0x74992be74bc3c3A72E97dF34A2C3A62c15f55970";
const WETH = "0x4200000000000000000000000000000000000006";
const BNKRW = "0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07";

// Only index ClaimTokens where feeOwner is ours and token is WETH or BNKRW
ponder.on("ClankerFeeLocker:ClaimTokens", async ({ event, context }) => {
  if (
    event.args.feeOwner.toLowerCase() !== CLANKER_FEE_OWNER.toLowerCase() ||
    (event.args.token.toLowerCase() !== WETH.toLowerCase() &&
      event.args.token.toLowerCase() !== BNKRW.toLowerCase())
  ) {
    return;
  }

  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(clankerClaim)
    .values({
      id,
      token: event.args.token,
      amount: event.args.amountClaimed,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});

// Index all WethClaimed events
ponder.on("WCHANDevFeeHook:WethClaimed", async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(hookClaim)
    .values({
      id,
      dev: event.args.dev,
      amount: event.args.amount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();
});
