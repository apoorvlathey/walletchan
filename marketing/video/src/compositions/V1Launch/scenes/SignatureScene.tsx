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

export const SignatureScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imgProgress = spring({
    frame: frame - (startFrame + 10),
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  const badgeProgress = spring({
    frame: frame - (startFrame + 20),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <FeatureLabel text="Signature Signing" enterFrame={startFrame + 5} />

      {/* "FINALLY!" badge */}
      {frame >= startFrame + 20 && (
        <div
          style={{
            position: "absolute",
            top: 120,
            right: 180,
            backgroundColor: "#F0C020",
            padding: "6px 18px",
            border: "3px solid #121212",
            boxShadow: "3px 3px 0px 0px #121212",
            transform: `scale(${badgeProgress}) rotate(-8deg)`,
            opacity: badgeProgress,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 22,
              color: "#121212",
              textTransform: "uppercase",
            }}
          >
            Finally!
          </span>
        </div>
      )}

      <div
        style={{
          marginTop: 30,
          transform: `scale(${imgProgress * 0.15 + 0.85}) translateY(${(1 - imgProgress) * 30}px)`,
          opacity: imgProgress,
        }}
      >
        <Img
          src={staticFile("SignatureRequest.png")}
          style={{
            height: 700,
            borderRadius: 12,
            boxShadow: "8px 8px 0px 0px #121212",
            border: "3px solid #121212",
          }}
        />
      </div>

      <TextOverlay
        text="Structured signature decoding for Bankr API accounts"
        enterFrame={startFrame + 55}
      />
    </AbsoluteFill>
  );
};
