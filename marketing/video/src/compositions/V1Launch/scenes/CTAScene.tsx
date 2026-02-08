import React from "react";
import {
  AbsoluteFill,
  Img,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const CTAScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - startFrame;
  if (relFrame < 0) return null;

  const versionProgress = spring({
    frame: relFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const liveProgress = spring({
    frame: relFrame - 12,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const logoProgress = spring({
    frame: relFrame - 24,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  const githubProgress = spring({
    frame: relFrame - 36,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Bauhaus decorators */}
      {/* Top-left: Red square */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 60,
          height: 60,
          backgroundColor: "#D02020",
          opacity: 0.15,
        }}
      />
      {/* Top-right: Blue circle */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: "#1040C0",
          opacity: 0.15,
        }}
      />
      {/* Bottom-left: Yellow triangle (using CSS borders) */}
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
          opacity: 0.15,
        }}
      />
      {/* Bottom-right: Red circle */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: "#D02020",
          opacity: 0.15,
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
        {/* v1.0.0 */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 120,
            color: "#D02020",
            textTransform: "uppercase",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            transform: `scale(${versionProgress})`,
            opacity: versionProgress,
          }}
        >
          v1.0.0
        </span>

        {/* LIVE NOW */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 64,
            color: "#121212",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            transform: `scale(${liveProgress})`,
            opacity: liveProgress,
          }}
        >
          Live Now
        </span>

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 24,
            opacity: logoProgress,
            transform: `translateY(${(1 - logoProgress) * 20}px)`,
          }}
        >
          <Img
            src={staticFile("bankrwallet-icon.png")}
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              boxShadow: "4px 4px 0px 0px #121212",
            }}
          />
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 32,
              color: "#121212",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
            }}
          >
            BankrWallet
          </span>
        </div>

        {/* GitHub link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            opacity: githubProgress,
            transform: `translateY(${(1 - githubProgress) * 15}px)`,
          }}
        >
          {/* GitHub icon (simple circle with octocat silhouette) */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "#121212",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 14,
                color: "#FFFFFF",
              }}
            >
              G
            </span>
          </div>
          <span
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 20,
              color: "#666",
            }}
          >
            github.com/apoorvlathey/bankr-wallet
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
