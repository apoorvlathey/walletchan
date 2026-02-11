export function formatMarketCap(mcap: number): string {
  if (mcap >= 1_000_000) {
    return `$${(mcap / 1_000_000).toFixed(2)}M`;
  } else if (mcap >= 1_000) {
    return `$${(mcap / 1_000).toFixed(2)}K`;
  } else {
    return `$${mcap.toFixed(2)}`;
  }
}
