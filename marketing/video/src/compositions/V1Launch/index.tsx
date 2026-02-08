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
import { HookScene } from "./scenes/HookScene";
import { LogoRevealScene } from "./scenes/LogoRevealScene";
import { AgentPasswordScene } from "./scenes/AgentPasswordScene";
import { AccountTypesScene } from "./scenes/AccountTypesScene";
import { PortfolioScene } from "./scenes/PortfolioScene";
import { DecodedTxScene } from "./scenes/DecodedTxScene";
import { SignatureScene } from "./scenes/SignatureScene";
import { TransferScene } from "./scenes/TransferScene";
import { MontageScene } from "./scenes/MontageScene";
import { CTAScene } from "./scenes/CTAScene";

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
        opacity: progress * 0.7,
        transform: `translateY(${(1 - progress) * 10}px)`,
        zIndex: 100,
      }}
    >
      <Img
        src={staticFile("bankrwallet-icon.png")}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
        }}
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
        BankrWallet
      </span>
    </div>
  );
};

/**
 * Scene timing (30fps):
 * 1. Hook:           0-120   (0-4s)
 * 2. Logo Reveal:    120-210 (4-7s)
 * 3. Agent Password: 210-330 (7-11s)
 * 4. Account Types:  330-450 (11-15s)
 * 5. Portfolio:      450-570 (15-19s)
 * 6. Decoded TX:     570-720 (19-24s)
 * 7. Signatures:     720-840 (24-28s)
 * 8. Transfers:      840-960 (28-32s)
 * 9. Montage:        960-1260 (32-42s)
 * 10. CTA:           1260-1500 (42-50s)
 */

export const V1Launch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      {/* Background music (normal speed) */}
      <Audio src={staticFile("8-bit-bg.mp3")} volume={0.5} startFrom={51} />

      {/* Scene 1: Hook - "AI Agents Need Wallets" */}
      <Sequence from={0} durationInFrames={120}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Logo Reveal + Version */}
      <Sequence from={120} durationInFrames={90}>
        <LogoRevealScene startFrame={0} />
      </Sequence>

      {/* Scene 3: Agent Password */}
      <Sequence from={210} durationInFrames={120}>
        <AgentPasswordScene startFrame={0} />
      </Sequence>

      {/* Scene 4: Account Types */}
      <Sequence from={330} durationInFrames={120}>
        <AccountTypesScene startFrame={0} />
      </Sequence>

      {/* Scene 5: Portfolio View */}
      <Sequence from={450} durationInFrames={120}>
        <PortfolioScene startFrame={0} />
      </Sequence>

      {/* Scene 6: Decoded Transactions */}
      <Sequence from={570} durationInFrames={150}>
        <DecodedTxScene startFrame={0} />
      </Sequence>

      {/* Scene 7: Signature Signing */}
      <Sequence from={720} durationInFrames={120}>
        <SignatureScene startFrame={0} />
      </Sequence>

      {/* Scene 8: Token Transfers */}
      <Sequence from={840} durationInFrames={120}>
        <TransferScene startFrame={0} />
      </Sequence>

      {/* Scene 9: Quick Feature Montage */}
      <Sequence from={960} durationInFrames={300}>
        <MontageScene startFrame={0} />
      </Sequence>

      {/* Scene 10: CTA Closing */}
      <Sequence from={1260} durationInFrames={240}>
        <CTAScene startFrame={0} />
      </Sequence>

      {/* Persistent brand watermark (scenes 3-9) */}
      <Sequence from={210} durationInFrames={1050}>
        <BrandWatermark />
      </Sequence>
    </AbsoluteFill>
  );
};
