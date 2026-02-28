import { config } from "../config.js";

interface BalanceResponse {
  id: string;
  shares: string;
}

/** Query sBNKRW balance from staking-indexer (legacy) */
export async function getUserBalance(address: string): Promise<bigint> {
  try {
    const res = await fetch(
      `${config.INDEXER_API_URL}/balances/${address.toLowerCase()}`
    );

    if (!res.ok) {
      if (res.status === 404) return 0n;
      throw new Error(`Indexer returned ${res.status}`);
    }

    const data: BalanceResponse = await res.json();
    return BigInt(data.shares);
  } catch (err) {
    console.error(`Failed to fetch sBNKRW balance for ${address}:`, err);
    return 0n;
  }
}

/** Query sWCHAN balance from wchan-vault-indexer */
export async function getWchanBalance(address: string): Promise<bigint> {
  try {
    const res = await fetch(
      `${config.WCHAN_VAULT_INDEXER_API_URL}/balances/${address.toLowerCase()}`
    );

    if (!res.ok) {
      if (res.status === 404) return 0n;
      throw new Error(`WCHAN vault indexer returned ${res.status}`);
    }

    const data: BalanceResponse = await res.json();
    return BigInt(data.shares);
  } catch (err) {
    console.error(`Failed to fetch sWCHAN balance for ${address}:`, err);
    return 0n;
  }
}

/** Query both indexers in parallel and return the max (backwards compat) */
export async function getCombinedBalance(address: string): Promise<bigint> {
  const [sBnkrw, sWchan] = await Promise.all([
    getUserBalance(address),
    getWchanBalance(address),
  ]);
  return sBnkrw > sWchan ? sBnkrw : sWchan;
}

export function meetsThreshold(shares: bigint): boolean {
  return shares >= BigInt(config.MIN_STAKE_THRESHOLD);
}

export function formatThreshold(): string {
  const raw = BigInt(config.MIN_STAKE_THRESHOLD);
  const whole = raw / 10n ** 18n;
  return whole.toLocaleString();
}
