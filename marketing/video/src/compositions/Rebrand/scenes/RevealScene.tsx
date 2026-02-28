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
 * Scene 2 — The Reveal (120 frames / 4s)
 * From darkness, the WalletChan mascot springs in.
 * "WalletChan" text and Bauhaus shapes animate in.
 */
export const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mascot springs in (frame 10)
  const mascotProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });

  // Name appears (frame 30)
  const nameProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  // Tagline (frame 50)
  const tagProgress = spring({
    frame: frame - 50,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  // Bauhaus shapes (frame 20)
  const shapeProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
  });

  return (
    <AbsoluteFill>
      {/* Bauhaus decorative shapes */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 80,
          width: 100,
          height: 100,
          borderRadius: "50%",
          backgroundColor: "#1040C0",
          opacity: shapeProgress * 0.2,
          transform: `scale(${shapeProgress}) translateX(${(1 - shapeProgress) * 100}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 80,
          width: 80,
          height: 80,
          backgroundColor: "#D02020",
          transform: `rotate(45deg) scale(${shapeProgress})`,
          opacity: shapeProgress * 0.2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 100,
          width: 60,
          height: 60,
          backgroundColor: "#F0C020",
          opacity: shapeProgress * 0.15,
          transform: `scale(${shapeProgress})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 120,
          width: 50,
          height: 50,
          border: "3px solid #121212",
          opacity: shapeProgress * 0.1,
          transform: `rotate(15deg) scale(${shapeProgress})`,
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Mascot */}
        <Img
          src={staticFile("walletchan-icon-nobg.png")}
          style={{
            width: 220,
            height: 220,
            transform: `scale(${mascotProgress})`,
            opacity: mascotProgress,
            filter: "drop-shadow(6px 6px 0px #121212)",
          }}
        />

        {/* "WalletChan" */}
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 80,
            color: "#121212",
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            transform: `scale(${nameProgress})`,
            opacity: nameProgress,
          }}
        >
          WalletChan
        </span>

        {/* $WCHAN ticker */}
        <div
          style={{
            backgroundColor: "#1040C0",
            padding: "6px 24px",
            transform: `scale(${tagProgress})`,
            opacity: tagProgress,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 32,
              color: "#FFFFFF",
              letterSpacing: "0.02em",
            }}
          >
            $WCHAN
          </span>
        </div>

        {/* Tagline */}
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 26,
            color: "#666",
            opacity: tagProgress,
            transform: `translateY(${(1 - tagProgress) * 15}px)`,
          }}
        >
          The wallet built for AI agents & humans
        </span>
      </div>

    </AbsoluteFill>
  );
};
