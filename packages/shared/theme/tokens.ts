/**
 * Bauhaus Design System - Shared Design Tokens
 *
 * Primary colors: Red, Blue, Yellow + Black/White contrast
 * These tokens can be used by both the extension and website.
 */

export const bauhausColors = {
  // Bauhaus Primary Colors
  red: "#D02020",
  blue: "#1040C0",
  yellow: "#F0C020",
  black: "#121212",
  white: "#FFFFFF",

  // Background colors
  background: "#F0F0F0",
  muted: "#E0E0E0",

  // Text colors
  foreground: "#121212",
  textSecondary: "#3A3A3A",
  textTertiary: "#666666",
} as const;

export const bauhausShadows = {
  sm: "3px 3px 0px 0px #121212",
  md: "4px 4px 0px 0px #121212",
  lg: "6px 6px 0px 0px #121212",
  xl: "8px 8px 0px 0px #121212",
} as const;

export const bauhausFonts = {
  heading:
    "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  body: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
} as const;

export const bauhausFontWeights = {
  medium: 500,
  bold: 700,
  black: 900,
} as const;

// Google Fonts import URL for Outfit font
export const outfitFontUrl =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;900&display=swap";

export type BauhausColors = typeof bauhausColors;
export type BauhausShadows = typeof bauhausShadows;
export type BauhausFonts = typeof bauhausFonts;
