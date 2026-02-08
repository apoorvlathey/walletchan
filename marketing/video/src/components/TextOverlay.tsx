import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const TextOverlay: React.FC<{
  text: string;
  enterFrame: number;
}> = ({ text, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: {
      damping: 14,
      stiffness: 150,
      mass: 0.6,
    },
  });

  if (frame < enterFrame) return null;

  const translateY = (1 - progress) * 30;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 60px",
        opacity: progress,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 34,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.35,
          maxWidth: 880,
          textShadow:
            "0 2px 8px rgba(0,0,0,0.7), 0 0px 20px rgba(0,0,0,0.5)",
          backgroundColor: "rgba(18, 18, 18, 0.75)",
          padding: "16px 28px",
          borderRadius: 12,
        }}
      >
        {text}
      </span>
    </div>
  );
};
