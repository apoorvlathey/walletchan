import React from "react";
import {
  Img,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const BankrLogo: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
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

  const translateY = (1 - progress) * 40;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: progress,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <Img
        src={staticFile("bankrwallet-icon.png")}
        style={{
          width: 64,
          height: 64,
          boxShadow: "4px 4px 0px 0px #121212",
          borderRadius: 8,
        }}
      />
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 36,
          color: "#121212",
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
        }}
      >
        BankrWallet
      </span>
    </div>
  );
};
