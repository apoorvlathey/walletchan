import { DRIP_ADDRESSES } from "@walletchan/contract-addresses";
import type { DefiAsset, DefiPosition, PortfolioToken } from "./apiTypes";

const WCHAN_CHAIN_ID = 8453;
const WCHAN_ADDRESS = DRIP_ADDRESSES[WCHAN_CHAIN_ID].wchan.toLowerCase();

/** Narrow exception to Holdings' general ERC-20 price-enrichment opt-out. */
export async function applyWchanPriceFallback(
  tokens: PortfolioToken[],
  defiPositions: DefiPosition[] = [],
): Promise<{ tokens: PortfolioToken[]; defiPositions: DefiPosition[] }> {
  const unchanged = { tokens, defiPositions };
  const needsPrice = (token: PortfolioToken) =>
    token.chainId === WCHAN_CHAIN_ID &&
    token.contractAddress.toLowerCase() === WCHAN_ADDRESS &&
    token.priceUsd === 0 &&
    Number(token.balance) > 0;
  const needsAssetPrice = (asset: DefiAsset) =>
    asset.chainId === WCHAN_CHAIN_ID &&
    asset.contractAddress.toLowerCase() === WCHAN_ADDRESS &&
    asset.valueUsd === 0 &&
    Number(asset.balance) > 0;
  const needsPositionPrice = (position: DefiPosition) =>
    position.chainId === WCHAN_CHAIN_ID &&
    [...position.assets, ...position.rewardAssets, ...(position.borrowAssets ?? [])].some(needsAssetPrice);
  if (!tokens.some(needsPrice) && !defiPositions.some(needsPositionPrice)) {
    return unchanged;
  }

  try {
    // Reuse the staking screen's price source, including its server cache.
    const response = await chrome.runtime.sendMessage({
      type: "fetchTokenPrice",
      chainId: WCHAN_CHAIN_ID,
      address: WCHAN_ADDRESS,
    });
    const priceUsd = Number(response?.priceUsd ?? 0);
    if (!response?.success || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      return unchanged;
    }
    const pricedTokens = tokens.map((token) => {
      if (!needsPrice(token)) return token;
      const valueUsd = Number(token.balance) * priceUsd;
      return Number.isFinite(valueUsd)
        ? { ...token, priceUsd, valueUsd }
        : token;
    });
    const pricedPositions = defiPositions.map((position) => {
      if (!needsPositionPrice(position)) return position;
      let addedValueUsd = 0;
      const priceAsset = (asset: DefiAsset, side = 1): DefiAsset => {
        if (!needsAssetPrice(asset)) return asset;
        const valueUsd = Number(asset.balance) * priceUsd;
        if (!Number.isFinite(valueUsd)) return asset;
        addedValueUsd += side * valueUsd;
        return { ...asset, valueUsd };
      };
      const assets = position.assets.map((asset) => priceAsset(asset));
      const rewardAssets = position.rewardAssets.map((asset) => priceAsset(asset));
      const borrowAssets = position.borrowAssets?.map((asset) => priceAsset(asset, -1));
      // Preserve provider-valued legs and only add the missing WCHAN value.
      const valueUsd = position.valueUsd + addedValueUsd;
      return Number.isFinite(valueUsd)
        ? { ...position, assets, rewardAssets, borrowAssets, valueUsd }
        : position;
    });
    return { tokens: pricedTokens, defiPositions: pricedPositions };
  } catch {
    return unchanged;
  }
}
