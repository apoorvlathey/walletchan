import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const FeatureLabel: React.FC<{
  text: string;
  enterFrame: number;
}> = ({ text, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
      mass: 0.5,
    },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 52,
          color: "#D02020",
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
};
