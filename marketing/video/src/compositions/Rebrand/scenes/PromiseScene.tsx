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

/** Wipe-reveal line: a colored bar sweeps left→right, revealing text behind it */
const WipeLine: React.FC<{
  children: React.ReactNode;
  /** Frame (local) when wipe starts */
  startFrame: number;
  /** How many frames the wipe takes */
  duration: number;
  /** Color of the sweep bar */
  barColor: string;
  frame: number;
  style?: React.CSSProperties;
}> = ({ children, startFrame, duration, barColor, frame, style }) => {
  // Reveal goes 0→1 over duration
  const reveal = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bar fades in 2 frames before, fades out 4 frames after
  const barOpacity = interpolate(
    frame,
    [startFrame - 2, startFrame, startFrame + duration, startFrame + duration + 4],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      {/* Sweep bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${reveal * 100}%`,
          width: 6,
          backgroundColor: barColor,
          opacity: barOpacity,
          zIndex: 1,
          boxShadow: `0 0 20px ${barColor}`,
        }}
      />
      {/* Text clipped to reveal progress */}
      <div style={{ clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)` }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Scene 3 — The Promise (150 frames / 5s)
 * "New Name" / "Same Vision" / "THE WALLET FOR AI ERA"
 * Color-bar wipe reveal: a thin colored line sweeps across each line,
 * revealing text like a printing press. Very Bauhaus / mechanical.
 */
export const PromiseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Badge slides up after line 3 wipe
  const badgeP = spring({
    frame: frame - 38,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  // Subtle watermark
  const wmProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
  });

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
          top: 80,
          left: 60,
          width: 40,
          height: 40,
          backgroundColor: "#1040C0",
          opacity: 0.12,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 120,
          right: 80,
          width: 50,
          height: 50,
          borderRadius: "50%",
          backgroundColor: "#D02020",
          opacity: 0.1,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* "New Name" — blue bar wipe */}
        <WipeLine
          startFrame={10}
          duration={8}
          barColor="#1040C0"
          frame={frame}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 80,
              color: "#121212",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            New Name
          </span>
        </WipeLine>

        {/* "Same Vision" — yellow bar wipe */}
        <WipeLine
          startFrame={22}
          duration={8}
          barColor="#F0C020"
          frame={frame}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 80,
              color: "#F0C020",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textShadow: "3px 3px 0px #121212",
              whiteSpace: "nowrap",
            }}
          >
            Same Vision
          </span>
        </WipeLine>

        {/* "THE WALLET FOR AI ERA" — red badge slides up */}
        <div
          style={{
            marginTop: 16,
            backgroundColor: "#D02020",
            padding: "12px 36px",
            opacity: badgeP,
            transform: `translateY(${(1 - badgeP) * 30}px)`,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 44,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            The Wallet for AI Era
          </span>
        </div>
      </div>

      {/* WalletChan watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: wmProgress * 0.6,
        }}
      >
        <Img
          src={staticFile("walletchan-icon-nobg.png")}
          style={{ width: 28, height: 28 }}
        />
        <span
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: 16,
            color: "#121212",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
          }}
        >
          WalletChan
        </span>
      </div>
    </AbsoluteFill>
  );
};
