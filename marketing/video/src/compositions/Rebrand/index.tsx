import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { OldGuardScene } from "./scenes/OldGuardScene";
import { RevealScene } from "./scenes/RevealScene";
import { PromiseScene } from "./scenes/PromiseScene";
import { FeatureShowcaseScene } from "./scenes/FeatureShowcaseScene";
import { TokenScene } from "./scenes/TokenScene";
import { MigrateCTAScene } from "./scenes/MigrateCTAScene";
import { ClosingScene } from "./scenes/ClosingScene";

const { fontFamily } = loadFont();

const BrandWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: progress * 0.6,
        transform: `translateY(${(1 - progress) * 10}px)`,
        zIndex: 100,
      }}
    >
      <Img
        src={staticFile("walletchan-icon-nobg.png")}
        style={{ width: 28, height: 28 }}
      />
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 16,
          color: "#121212",
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
        }}
      >
        WalletChan
      </span>
    </div>
  );
};

// ── Scene durations (change here, everything recalculates) ──
const OVERLAP = 10; // frames of overlap between consecutive scenes

const D_OLD_GUARD = 50;
const D_REVEAL = 90;
const D_PROMISE = 80;
const D_TOKEN = 210;
const D_MIGRATE = 66;
const D_FEATURES = 546; // 35 header + 9 features × 56 + 1 buffer
const D_CLOSING = 130;

// ── Computed start frames (each scene overlaps the previous by OVERLAP) ──
const S_OLD_GUARD = 0;
const S_REVEAL = 20; // starts early so it's visible behind shattering fragments
const S_PROMISE = S_REVEAL + D_REVEAL - OVERLAP;
const S_TOKEN = S_PROMISE + D_PROMISE - OVERLAP;
const S_MIGRATE = S_TOKEN + D_TOKEN - OVERLAP;
const S_FEATURES = S_MIGRATE + D_MIGRATE; // no overlap — Migrate content stays visible till end
const S_CLOSING = S_FEATURES + D_FEATURES - OVERLAP;

// Watermark runs from Token through end of Features
const S_WATERMARK = S_TOKEN;
const D_WATERMARK = S_CLOSING - S_TOKEN;

export const Rebrand: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      {/* Background music — starts after the dissolve */}
      <Audio src={staticFile("8-bit-bg.mp3")} volume={0.5} startFrom={51} />

      {/* Scenes are layered bottom-to-top in JSX order.
          Each scene overlaps the previous by ~OVERLAP frames so there's
          no white gap — the new scene's content springs in while
          the old scene is still visible beneath it. */}

      <Sequence name="2. Reveal" from={S_REVEAL} durationInFrames={D_REVEAL}>
        <RevealScene />
      </Sequence>

      {/* Old Guard renders on top — fragments fly apart revealing Reveal */}
      <Sequence name="1. Old Guard" from={S_OLD_GUARD} durationInFrames={D_OLD_GUARD}>
        <OldGuardScene />
      </Sequence>

      <Sequence name="3. Promise" from={S_PROMISE} durationInFrames={D_PROMISE}>
        <PromiseScene />
      </Sequence>

      <Sequence name="4. Token" from={S_TOKEN} durationInFrames={D_TOKEN}>
        <TokenScene />
      </Sequence>

      <Sequence name="5. Migrate CTA" from={S_MIGRATE} durationInFrames={D_MIGRATE}>
        <MigrateCTAScene />
      </Sequence>

      <Sequence name="6. Features" from={S_FEATURES} durationInFrames={D_FEATURES}>
        <FeatureShowcaseScene />
      </Sequence>

      <Sequence name="7. Closing" from={S_CLOSING} durationInFrames={D_CLOSING}>
        <ClosingScene />
      </Sequence>

      <Sequence name="Watermark" from={S_WATERMARK} durationInFrames={D_WATERMARK}>
        <BrandWatermark />
      </Sequence>
    </AbsoluteFill>
  );
};
