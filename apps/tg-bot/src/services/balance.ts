import { config } from "../config.js";

interface BalanceResponse {
  id: string;
  shares: string;
}

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
    console.error(`Failed to fetch balance for ${address}:`, err);
    return 0n;
  }
}

export function meetsThreshold(shares: bigint): boolean {
  return shares >= BigInt(config.MIN_STAKE_THRESHOLD);
}

export function formatThreshold(): string {
  const raw = BigInt(config.MIN_STAKE_THRESHOLD);
  const whole = raw / 10n ** 18n;
  return whole.toLocaleString();
}
