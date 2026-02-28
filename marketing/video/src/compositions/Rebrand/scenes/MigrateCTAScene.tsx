import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

/**
 * Scene 6 — Migrate CTA (90 frames / 3s)
 * "Migrate Now" + migrate.walletchan.com
 */
export const MigrateCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingP = spring({
    frame: frame - 5,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const urlP = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  // Gentle pulse on the CTA button
  const pulse = 1 + Math.sin(frame * 0.1) * 0.02;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Bauhaus corner accents */}
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
          bottom: 40,
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* "Migrate Now" button */}
        <div
          style={{
            backgroundColor: "#D02020",
            padding: "20px 64px",
            border: "4px solid #121212",
            boxShadow: "8px 8px 0px 0px #121212",
            transform: `scale(${headingP * pulse})`,
            opacity: headingP,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 64,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
            }}
          >
            Migrate Now
          </span>
        </div>

        {/* URL */}
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 32,
            color: "#121212",
            opacity: urlP,
            transform: `translateY(${(1 - urlP) * 15}px)`,
          }}
        >
          migrate.walletchan.com
        </span>
      </div>
    </AbsoluteFill>
  );
};
