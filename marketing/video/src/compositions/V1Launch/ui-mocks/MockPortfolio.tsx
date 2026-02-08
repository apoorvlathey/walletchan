import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

const TokenRow: React.FC<{
  symbol: string;
  color: string;
  amount: string;
  value: string;
  enterFrame: number;
}> = ({ symbol, color, amount, value, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #E0E0E0",
        opacity: progress,
        transform: `translateX(${(1 - progress) * 20}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: color,
            border: "2px solid #121212",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 11,
              color: "#FFFFFF",
            }}
          >
            {symbol.slice(0, 2)}
          </span>
        </div>
        <div>
          <div
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 15,
              color: "#121212",
            }}
          >
            {symbol}
          </div>
          <div
            style={{
              fontFamily,
              fontWeight: 500,
              fontSize: 12,
              color: "#888",
            }}
          >
            {amount}
          </div>
        </div>
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 15,
          color: "#121212",
        }}
      >
        {value}
      </div>
    </div>
  );
};

const PortfolioIcon: React.FC<{
  label: string;
  color: string;
}> = ({ label, color }) => (
  <div
    style={{
      width: 36,
      height: 36,
      backgroundColor: color,
      borderRadius: 6,
      border: "2px solid #121212",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        fontFamily,
        fontWeight: 900,
        fontSize: 11,
        color: "#FFFFFF",
      }}
    >
      {label}
    </span>
  </div>
);

export const MockPortfolio: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: headerProgress,
      }}
    >
      {/* Account + Chain selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            backgroundColor: "#121212",
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 13,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            DEV
          </span>
          <span style={{ fontFamily, fontSize: 12, color: "#888" }}>▼</span>
        </div>
        <div
          style={{
            backgroundColor: "#1040C0",
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
            }}
          />
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 13,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            Ethereum
          </span>
        </div>
      </div>

      {/* Address */}
      <div
        style={{
          backgroundColor: "#F0F0F0",
          border: "2px solid #E0E0E0",
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 13,
            color: "#121212",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          0x1a2B...9c4D
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <PortfolioIcon label="DB" color="#22C55E" />
          <PortfolioIcon label="ZR" color="#7C3AED" />
          <PortfolioIcon label="ZP" color="#3B82F6" />
          <PortfolioIcon label="NS" color="#F59E0B" />
        </div>
      </div>

      {/* Holdings */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <TokenRow
          symbol="USDC"
          color="#2775CA"
          amount="50.14"
          value="$50.14"
          enterFrame={enterFrame + 10}
        />
        <TokenRow
          symbol="ETH"
          color="#627EEA"
          amount="0.0058"
          value="$18.85"
          enterFrame={enterFrame + 16}
        />
        <TokenRow
          symbol="MATIC"
          color="#8247E5"
          amount="7.28"
          value="$5.29"
          enterFrame={enterFrame + 22}
        />
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 0",
          borderTop: "3px solid #121212",
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 14,
            color: "#888",
            textTransform: "uppercase",
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 24,
            color: "#121212",
          }}
        >
          $85.69
        </span>
      </div>
    </div>
  );
};
