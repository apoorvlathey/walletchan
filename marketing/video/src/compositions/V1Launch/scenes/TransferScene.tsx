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
import { FeatureLabel } from "../../../components/FeatureLabel";
import { TextOverlay } from "../../../components/TextOverlay";

const { fontFamily } = loadFont();

const DomainBadge: React.FC<{
  label: string;
  color: string;
  enterFrame: number;
}> = ({ label, color, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        backgroundColor: color,
        padding: "6px 14px",
        border: "2px solid #121212",
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 14,
          color: "#FFFFFF",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const TransferScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imgProgress = spring({
    frame: frame - (startFrame + 10),
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <FeatureLabel text="Send Tokens" enterFrame={startFrame + 5} />

      <div
        style={{
          marginTop: 30,
          transform: `scale(${imgProgress * 0.15 + 0.85}) translateY(${(1 - imgProgress) * 30}px)`,
          opacity: imgProgress,
        }}
      >
        <Img
          src={staticFile("TokenTransfer.png")}
          style={{
            height: 700,
            borderRadius: 12,
            boxShadow: "8px 8px 0px 0px #121212",
            border: "3px solid #121212",
          }}
        />
      </div>

      {/* Domain badges */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          display: "flex",
          gap: 12,
        }}
      >
        <DomainBadge label=".eth" color="#1040C0" enterFrame={startFrame + 60} />
        <DomainBadge label=".base" color="#D02020" enterFrame={startFrame + 68} />
        <DomainBadge label=".wei" color="#F0C020" enterFrame={startFrame + 76} />
      </div>

      <TextOverlay
        text="ENS + Basenames + .WEI domain resolution"
        enterFrame={startFrame + 50}
      />
    </AbsoluteFill>
  );
};
