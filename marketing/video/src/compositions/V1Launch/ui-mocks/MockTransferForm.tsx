import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const MockTransferForm: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
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
        gap: 14,
        opacity: progress,
      }}
    >
      {/* Token header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 8,
          borderBottom: "2px solid #E0E0E0",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#2775CA",
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
              fontSize: 13,
              color: "#FFFFFF",
            }}
          >
            US
          </span>
        </div>
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 20,
            color: "#121212",
            textTransform: "uppercase",
          }}
        >
          Send USDC
        </span>
      </div>

      {/* To Address field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 12,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          To Address
        </span>
        <div
          style={{
            backgroundColor: "#F0F0F0",
            border: "2px solid #121212",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "#7C3AED",
                border: "2px solid #121212",
              }}
            />
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 15,
                color: "#121212",
              }}
            >
              apoorv.eth
            </span>
          </div>
          <span
            style={{
              fontFamily,
              fontWeight: 500,
              fontSize: 11,
              color: "#22C55E",
            }}
          >
            Resolved ✓
          </span>
        </div>
      </div>

      {/* Amount field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 12,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Amount
        </span>
        <div
          style={{
            backgroundColor: "#F0F0F0",
            border: "2px solid #121212",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 22,
              color: "#121212",
            }}
          >
            25.00
          </span>
          <div
            style={{
              backgroundColor: "#1040C0",
              padding: "4px 12px",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 12,
                color: "#FFFFFF",
                textTransform: "uppercase",
              }}
            >
              MAX
            </span>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div
        style={{
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
            color: "#888",
          }}
        >
          Balance
        </span>
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 13,
            color: "#121212",
          }}
        >
          50.14 USDC
        </span>
      </div>

      {/* Send button */}
      <div
        style={{
          padding: "16px 0",
          backgroundColor: "#1040C0",
          border: "3px solid #121212",
          boxShadow: "4px 4px 0px 0px #121212",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 16,
            color: "#FFFFFF",
            textTransform: "uppercase",
          }}
        >
          Send USDC
        </span>
      </div>
    </div>
  );
};
