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

/**
 * Scene 7 — Closing (120 frames / 4s)
 * WalletChan mascot + name + "v2 Live on Chrome Web Store" + walletchan.com
 */
export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mascotP = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.6 },
  });

  const nameP = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const badgeP = spring({
    frame: frame - 28,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const urlP = spring({
    frame: frame - 40,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  // Subtle float on mascot
  const floatY = Math.sin(frame * 0.06) * 5;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Bauhaus corner decorators */}
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
          gap: 16,
        }}
      >
        {/* Mascot */}
        <Img
          src={staticFile("walletchan-animated.gif")}
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            transform: `scale(${mascotP}) translateY(${floatY}px)`,
            opacity: mascotP,
            filter: "drop-shadow(6px 6px 0px #121212)",
          }}
        />

        {/* "WalletChan" */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 72,
            color: "#121212",
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            opacity: nameP,
            transform: `translateY(${(1 - nameP) * 15}px)`,
          }}
        >
          WalletChan
        </span>

        {/* $WCHAN ticker */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 28,
            color: "#1040C0",
            opacity: nameP,
            transform: `translateY(${(1 - nameP) * 15}px)`,
          }}
        >
          $WCHAN
        </span>

        {/* v2 badge */}
        <div
          style={{
            backgroundColor: "#1040C0",
            padding: "8px 28px",
            marginTop: 28,
            transform: `scale(${badgeP})`,
            opacity: badgeP,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 24,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            v2 Live on Chrome Web Store
          </span>
        </div>

        {/* URL */}
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 28,
            color: "#666",
            opacity: urlP,
            transform: `translateY(${(1 - urlP) * 10}px)`,
          }}
        >
          walletchan.com
        </span>
      </div>
    </AbsoluteFill>
  );
};
