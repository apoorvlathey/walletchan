import { formatEther, formatUnits } from "viem";

// ============================================================================
// Types
// ============================================================================

export type ETHSelectedOption =
  | "Wei"
  | "ETH"
  | "Gwei"
  | "10^6"
  | "Unix Time"
  | "Bps ↔ %"
  | "Minutes"
  | "Hours"
  | "Days";

export const ethFormatOptions: ETHSelectedOption[] = [
  "Wei",
  "ETH",
  "Gwei",
  "10^6",
  "Unix Time",
  "Bps ↔ %",
  "Minutes",
  "Hours",
  "Days",
];

// ============================================================================
// Conversion
// ============================================================================

export function convertTo(
  value: string,
  option: ETHSelectedOption
): string {
  try {
    const bn = BigInt(value);
    switch (option) {
      case "Wei":
        return value;
      case "ETH":
        return formatEther(bn);
      case "Gwei":
        return formatUnits(bn, 9);
      case "10^6":
        return formatUnits(bn, 6);
      case "Unix Time":
        return convertUnixSecondsToGMT(Number(bn));
      case "Bps ↔ %":
        return `${(Number(bn) / 100).toFixed(2)}%`;
      case "Minutes":
        return `${(Number(bn) / 60).toFixed(2)} min`;
      case "Hours":
        return `${(Number(bn) / 3600).toFixed(2)} hrs`;
      case "Days":
        return `${(Number(bn) / 86400).toFixed(2)} days`;
      default:
        return value;
    }
  } catch {
    return value;
  }
}

export function convertUnixSecondsToGMT(unixSeconds: number): string {
  try {
    const date = new Date(unixSeconds * 1000);
    if (isNaN(date.getTime())) return String(unixSeconds);
    return date.toUTCString();
  } catch {
    return String(unixSeconds);
  }
}

// ============================================================================
// Formatting
// ============================================================================

export function formatWithCommas(value: string): string {
  try {
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  } catch {
    return value;
  }
}

export function formatCompact(value: string): string {
  try {
    const num = Number(value);
    if (isNaN(num)) return value;
    if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return value;
  } catch {
    return value;
  }
}

// ============================================================================
// Detection helpers
// ============================================================================

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isBigInt(value: string): boolean {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}

export function decodeBase64(str: string): { decoded: string; isJSON: boolean; isSVG: boolean } | null {
  try {
    // Check for base64 data URI prefix
    let base64Str = str;
    if (str.startsWith("data:")) {
      const commaIdx = str.indexOf(",");
      if (commaIdx === -1) return null;
      base64Str = str.slice(commaIdx + 1);
    }

    // Validate base64 characters
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Str.replace(/\s/g, ""))) return null;

    const decoded = atob(base64Str.replace(/\s/g, ""));

    // Check if printable
    const printable = [...decoded].every(
      (c) => c.charCodeAt(0) >= 32 || c === "\n" || c === "\r" || c === "\t"
    );
    if (!printable) return null;

    return {
      decoded,
      isJSON: isValidJSON(decoded),
      isSVG: decoded.trimStart().startsWith("<svg"),
    };
  } catch {
    return null;
  }
}
