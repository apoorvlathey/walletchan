import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

const AccountCard: React.FC<{
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  enterFrame: number;
}> = ({ icon, iconBg, title, subtitle, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        width: 260,
        backgroundColor: "#FFFFFF",
        border: "3px solid #121212",
        boxShadow: "4px 4px 0px 0px #121212",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          backgroundColor: iconBg,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #121212",
        }}
      >
        <span style={{ fontSize: 28 }}>{icon}</span>
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 16,
          color: "#121212",
          textTransform: "uppercase",
          textAlign: "center",
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: 13,
          color: "#666",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

export const MockAccountCards: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <AccountCard
        icon="🤖"
        iconBg="#1040C0"
        title="Bankr Wallet"
        subtitle="AI-powered, no seed phrases"
        enterFrame={enterFrame}
      />
      <AccountCard
        icon="🔑"
        iconBg="#F0C020"
        title="Private Key"
        subtitle="Import key, sign locally"
        enterFrame={enterFrame + 10}
      />
      <AccountCard
        icon="🌱"
        iconBg="#D02020"
        title="Seed Phrase"
        subtitle="BIP39 mnemonic, multi-account"
        enterFrame={enterFrame + 20}
      />
    </div>
  );
};
