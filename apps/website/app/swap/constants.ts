// Base chain ID
export const SWAP_CHAIN_ID = 8453;

// Fee configuration
export const FEE_BPS = "90"; // 0.9%

// Native ETH placeholder used by 0x API
export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// WETH on Base
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// Default slippage in basis points (5% for memecoins)
export const DEFAULT_SLIPPAGE_BPS = 500;
export const SLIPPAGE_PRESETS = [100, 300, 500]; // 1%, 3%, 5%

// Bungee API (public sandbox — no API key needed)
export const BUNGEE_BASE_URL = "https://public-backend.bungee.exchange";
export const BUNGEE_NATIVE_TOKEN =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// Relay API (no API key needed for public access)
export const RELAY_BASE_URL = "https://api.relay.link";
export const RELAY_NATIVE_TOKEN =
  "0x0000000000000000000000000000000000000000";
