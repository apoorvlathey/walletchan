import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const MockTxConfirmation: React.FC<{
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
        gap: 12,
        opacity: progress,
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0 }}>
        <div
          style={{
            flex: 1,
            padding: "10px 0",
            backgroundColor: "#1040C0",
            textAlign: "center",
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
            Decoded
          </span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "10px 0",
            backgroundColor: "#E0E0E0",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 13,
              color: "#888",
              textTransform: "uppercase",
            }}
          >
            Raw
          </span>
        </div>
      </div>

      {/* Function name badge */}
      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          backgroundColor: "#1040C0",
          padding: "6px 16px",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 16,
            color: "#FFFFFF",
          }}
        >
          transfer
        </span>
      </div>

      {/* Params */}
      <div
        style={{
          backgroundColor: "#F8F8F8",
          border: "2px solid #E0E0E0",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* to param */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 12,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            to (address)
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
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
        </div>

        {/* value param */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 12,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            value (uint256)
          </span>
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 15,
              color: "#F0C020",
            }}
          >
            1,000,000 WEI
          </span>
        </div>
      </div>

      {/* Tenderly button */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #7C3AED",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "#7C3AED",
          }}
        />
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 13,
            color: "#7C3AED",
            textTransform: "uppercase",
          }}
        >
          Simulate on Tenderly
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <div
          style={{
            flex: 1,
            padding: "14px 0",
            backgroundColor: "#FFFFFF",
            border: "3px solid #D02020",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 15,
              color: "#D02020",
              textTransform: "uppercase",
            }}
          >
            Reject
          </span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "14px 0",
            backgroundColor: "#22C55E",
            border: "3px solid #121212",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 15,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            Confirm
          </span>
        </div>
      </div>
    </div>
  );
};
