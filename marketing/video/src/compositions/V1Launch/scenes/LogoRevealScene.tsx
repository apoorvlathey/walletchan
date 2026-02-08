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

export const LogoRevealScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - startFrame;
  if (relFrame < 0) return null;

  const iconProgress = spring({
    frame: relFrame,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.6 },
  });

  const textProgress = spring({
    frame: relFrame - 10,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  const badgeProgress = spring({
    frame: relFrame - 22,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const subtitleProgress = spring({
    frame: relFrame - 35,
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Icon */}
        <Img
          src={staticFile("bankrwallet-icon.png")}
          style={{
            width: 160,
            height: 160,
            borderRadius: 20,
            boxShadow: "8px 8px 0px 0px #121212",
            transform: `scale(${iconProgress})`,
            opacity: iconProgress,
          }}
        />

        {/* Name */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 64,
            color: "#121212",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            opacity: textProgress,
            transform: `translateY(${(1 - textProgress) * 20}px)`,
          }}
        >
          BankrWallet
        </span>

        {/* Version badge */}
        <div
          style={{
            backgroundColor: "#D02020",
            padding: "8px 28px",
            transform: `scale(${badgeProgress})`,
            opacity: badgeProgress,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 32,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            v1.0.0
          </span>
        </div>

        {/* Subtitle */}
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 24,
            color: "#666",
            opacity: subtitleProgress,
            transform: `translateY(${(1 - subtitleProgress) * 15}px)`,
          }}
        >
          The wallet built for AI agents & humans
        </span>
      </div>
    </AbsoluteFill>
  );
};
