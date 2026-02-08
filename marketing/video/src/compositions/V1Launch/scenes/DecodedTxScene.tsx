import React from "react";
import {
  AbsoluteFill,
  Img,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FeatureLabel } from "../../../components/FeatureLabel";
import { TextOverlay } from "../../../components/TextOverlay";

export const DecodedTxScene: React.FC<{
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
      <FeatureLabel
        text="Human-Readable Transactions"
        enterFrame={startFrame + 5}
      />

      <div
        style={{
          marginTop: 30,
          transform: `scale(${imgProgress * 0.15 + 0.85}) translateY(${(1 - imgProgress) * 30}px)`,
          opacity: imgProgress,
        }}
      >
        <Img
          src={staticFile("TransactionRequest.png")}
          style={{
            height: 700,
            borderRadius: 12,
            boxShadow: "8px 8px 0px 0px #121212",
            border: "3px solid #121212",
          }}
        />
      </div>

      <TextOverlay
        text="Decoded calldata + ENS resolution + Tenderly simulation"
        enterFrame={startFrame + 60}
      />
    </AbsoluteFill>
  );
};
