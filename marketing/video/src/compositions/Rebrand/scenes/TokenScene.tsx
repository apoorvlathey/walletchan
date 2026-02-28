import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

/**
 * Scene 5 — Token: Same Value, New Name (150 frames / 5s)
 *
 * Beat 1 (0-105): $BNKRW → $WCHAN, "1:1 Wrapper. Same Market Cap."
 * Beat 2 (105-210): Stake $WCHAN, Earn WETH + WCHAN Yield
 */
export const TokenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Beat 1: The Wrap ──

  const bnkrwP = spring({
    frame: frame - 8,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const arrowP = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const wchanP = spring({
    frame: frame - 30,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const wrapTextP = spring({
    frame: frame - 42,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  // Beat 1 fade out
  const beat1Fade = interpolate(frame, [95, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Beat 2: The Upgrade ──

  const stakeP = spring({
    frame: frame - 110,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const yieldP = spring({
    frame: frame - 125,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const urlP = spring({
    frame: frame - 140,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const isBeat2 = frame >= 105;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Bauhaus accents */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: "#1040C0",
          opacity: 0.12,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          width: 0,
          height: 0,
          borderLeft: "30px solid transparent",
          borderRight: "30px solid transparent",
          borderBottom: "52px solid #F0C020",
          opacity: 0.12,
        }}
      />

      {/* Beat 1: $BNKRW → $WCHAN */}
      {!isBeat2 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            opacity: beat1Fade,
          }}
        >
          {/* Token transformation */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* $BNKRW */}
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 64,
                color: "#888",
                textTransform: "uppercase",
                opacity: bnkrwP,
                transform: `translateX(${(1 - bnkrwP) * -40}px)`,
              }}
            >
              $BNKRW
            </span>

            {/* Arrow */}
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 56,
                color: "#D02020",
                transform: `scale(${arrowP})`,
                opacity: arrowP,
              }}
            >
              →
            </span>

            {/* $WCHAN */}
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 64,
                color: "#1040C0",
                textTransform: "uppercase",
                opacity: wchanP,
                transform: `translateX(${(1 - wchanP) * 40}px)`,
              }}
            >
              $WCHAN
            </span>
          </div>

          {/* Wrap info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              opacity: wrapTextP,
              transform: `translateY(${(1 - wrapTextP) * 15}px)`,
            }}
          >
            <div
              style={{
                backgroundColor: "#F0C020",
                padding: "10px 32px",
                border: "3px solid #121212",
                boxShadow: "4px 4px 0px 0px #121212",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 900,
                  fontSize: 32,
                  color: "#121212",
                  textTransform: "uppercase",
                }}
              >
                1:1 Wrapper
              </span>
            </div>
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 28,
                color: "#121212",
              }}
            >
              Same Market Cap across tokens.
            </span>
            <Img
              src={staticFile("mcap-comparison.png")}
              style={{
                width: 800,
                marginTop: 8,
                borderRadius: 8,
                border: "3px solid #121212",
                boxShadow: "4px 4px 0px 0px #121212",
              }}
            />
          </div>
        </div>
      )}

      {/* Beat 2: Staking yield */}
      {isBeat2 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Stake header */}
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 64,
              color: "#121212",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              transform: `scale(${stakeP})`,
              opacity: stakeP,
            }}
          >
            Stake $WCHAN
          </span>

          {/* Yield info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: yieldP,
              transform: `translateY(${(1 - yieldP) * 20}px)`,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 36,
                color: "#666",
              }}
            >
              Earn
            </span>
            <div
              style={{
                backgroundColor: "#1040C0",
                padding: "8px 24px",
                border: "3px solid #121212",
                boxShadow: "4px 4px 0px 0px #121212",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 900,
                  fontSize: 36,
                  color: "#FFFFFF",
                }}
              >
                ETH + WCHAN
              </span>
            </div>
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 36,
                color: "#666",
              }}
            >
              Yield
            </span>
          </div>

          {/* APY screenshot */}
          <Img
            src={staticFile("stake-apy.png")}
            style={{
              width: 750,
              opacity: urlP,
              transform: `translateY(${(1 - urlP) * 10}px)`,
            }}
          />

          {/* URL */}
          <span
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 24,
              color: "#888",
              opacity: urlP,
              transform: `translateY(${(1 - urlP) * 10}px)`,
            }}
          >
            stake.walletchan.com
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
