import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

const PermissionRow: React.FC<{
  label: string;
  allowed: boolean;
  enterFrame: number;
  highlight?: boolean;
}> = ({ label, allowed, enterFrame, highlight = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  if (frame < enterFrame) return null;

  const pulseScale = highlight
    ? 1 + Math.sin((frame - enterFrame) * 0.15) * 0.03
    : 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 20px",
        backgroundColor: highlight ? "rgba(208, 32, 32, 0.08)" : "transparent",
        border: highlight ? "2px solid #D02020" : "2px solid transparent",
        opacity: progress,
        transform: `scale(${progress * pulseScale}) translateX(${(1 - progress) * 20}px)`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: allowed ? "#22C55E" : "#D02020",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 20,
            color: "#FFFFFF",
          }}
        >
          {allowed ? "\u2713" : "\u2717"}
        </span>
      </div>
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 24,
          color: highlight ? "#D02020" : "#121212",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const MockAgentPassword: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardProgress = spring({
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
        gap: 20,
        opacity: cardProgress,
        transform: `translateX(${(1 - cardProgress) * 60}px)`,
      }}
    >
      {/* Agent Password card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "3px solid #121212",
          boxShadow: "6px 6px 0px 0px #121212",
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          {/* Robot icon */}
          <div
            style={{
              width: 56,
              height: 56,
              backgroundColor: "#1040C0",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 30 }}>🤖</span>
          </div>
          <div>
            <div
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 24,
                color: "#121212",
                textTransform: "uppercase",
              }}
            >
              Agent Password
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 500,
                fontSize: 16,
                color: "#888",
              }}
            >
              Separate access for AI agents
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              backgroundColor: "#22C55E",
              padding: "6px 16px",
              borderRadius: 6,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 16,
                color: "#FFFFFF",
                textTransform: "uppercase",
              }}
            >
              ON
            </span>
          </div>
          <span
            style={{
              fontFamily,
              fontSize: 26,
              color: "#888",
            }}
          >
            ›
          </span>
        </div>
      </div>

      {/* Permissions list */}
      <div
        style={{
          backgroundColor: "#F8F8F8",
          border: "2px solid #E0E0E0",
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 16,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "6px 20px",
          }}
        >
          Agent Permissions
        </div>
        <PermissionRow
          label="Sign Transactions"
          allowed={true}
          enterFrame={enterFrame + 8}
        />
        <PermissionRow
          label="Sign Messages"
          allowed={true}
          enterFrame={enterFrame + 14}
        />
        <PermissionRow
          label="Reveal Private Keys"
          allowed={false}
          enterFrame={enterFrame + 20}
          highlight={true}
        />
      </div>
    </div>
  );
};
