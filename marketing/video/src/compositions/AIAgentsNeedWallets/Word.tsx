import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const Word: React.FC<{
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
    <span
      style={{
        display: "inline-block",
        fontFamily,
        fontWeight: 900,
        fontSize: 140,
        color: "#D02020",
        textTransform: "uppercase",
        letterSpacing: "-0.04em",
        lineHeight: 1,
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      {text}
    </span>
  );
};
