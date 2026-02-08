import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

// Each sub-scene is 75 frames (2.5s at 30fps)
const SUB_SCENE_DURATION = 75;

const SubScene: React.FC<{
  children: React.ReactNode;
  startFrame: number;
}> = ({ children, startFrame }) => {
  const frame = useCurrentFrame();

  const endFrame = startFrame + SUB_SCENE_DURATION;
  if (frame < startFrame || frame >= endFrame) return null;

  return <AbsoluteFill>{children}</AbsoluteFill>;
};

const MontageTitle: React.FC<{
  title: string;
  subtitle: string;
  startFrame: number;
}> = ({ title, subtitle, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame: frame - (startFrame + 5),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const subProgress = spring({
    frame: frame - (startFrame + 18),
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 56,
          color: "#D02020",
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          transform: `scale(${titleProgress})`,
          opacity: titleProgress,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily,
          fontWeight: 600,
          fontSize: 26,
          color: "#666",
          opacity: subProgress,
          transform: `translateY(${(1 - subProgress) * 15}px)`,
        }}
      >
        {subtitle}
      </span>
    </div>
  );
};

// 9a: Full-Screen Mode
const FullScreenScene: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const expandProgress = spring({
    frame: frame - (startFrame + 10),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Expanding box animation */}
        <div
          style={{
            position: "relative",
            width: 200 + expandProgress * 400,
            height: 150 + expandProgress * 250,
            border: "3px solid #121212",
            boxShadow: "6px 6px 0px 0px #121212",
            backgroundColor: "#F8F8F8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Arrow expand icon */}
          <span
            style={{
              fontFamily,
              fontSize: 40,
              color: "#1040C0",
              opacity: 1 - expandProgress * 0.5,
            }}
          >
            ⤢
          </span>
        </div>

        <MontageTitle
          title="Full-Screen Mode"
          subtitle="Easier for AI agents to operate"
          startFrame={startFrame}
        />
      </div>
    </AbsoluteFill>
  );
};

// 9b: Sidepanel
const SidepanelScene: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideProgress = spring({
    frame: frame - (startFrame + 8),
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Browser + Sidepanel mockup */}
        <div style={{ display: "flex", gap: 0 }}>
          {/* Main browser area */}
          <div
            style={{
              width: 400,
              height: 280,
              border: "3px solid #E0E0E0",
              backgroundColor: "#F8F8F8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 600,
                fontSize: 18,
                color: "#CCC",
              }}
            >
              Browser Tab
            </span>
          </div>
          {/* Sidepanel */}
          <div
            style={{
              width: 180,
              height: 280,
              border: "3px solid #121212",
              boxShadow: "4px 4px 0px 0px #121212",
              backgroundColor: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transform: `translateX(${(1 - slideProgress) * 200}px)`,
              opacity: slideProgress,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                backgroundColor: "#1040C0",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 900,
                  fontSize: 12,
                  color: "#FFFFFF",
                }}
              >
                BW
              </span>
            </div>
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 11,
                color: "#121212",
                textTransform: "uppercase",
              }}
            >
              BankrWallet
            </span>
          </div>
        </div>

        <MontageTitle
          title="Sidepanel Access"
          subtitle="Always one click away"
          startFrame={startFrame}
        />
      </div>
    </AbsoluteFill>
  );
};

// 9c: Impersonate Mode
const ImpersonateScene: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inputProgress = spring({
    frame: frame - (startFrame + 8),
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  const badgeProgress = spring({
    frame: frame - (startFrame + 25),
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Address input */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            opacity: inputProgress,
            transform: `translateY(${(1 - inputProgress) * 20}px)`,
          }}
        >
          <div
            style={{
              width: 500,
              padding: "16px 24px",
              border: "3px solid #121212",
              boxShadow: "4px 4px 0px 0px #121212",
              backgroundColor: "#F8F8F8",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 600,
                fontSize: 18,
                color: "#121212",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              0x1a2B3c4D5e6F7a8B9c0D1e2F...
            </span>
          </div>

          {/* VIEW-ONLY badge */}
          <div
            style={{
              backgroundColor: "#F0C020",
              padding: "6px 20px",
              border: "2px solid #121212",
              transform: `scale(${badgeProgress})`,
              opacity: badgeProgress,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 16,
                color: "#121212",
                textTransform: "uppercase",
              }}
            >
              View-Only
            </span>
          </div>
        </div>

        <MontageTitle
          title="Impersonate Any Address"
          subtitle="View-only mode for any wallet"
          startFrame={startFrame}
        />
      </div>
    </AbsoluteFill>
  );
};

// 9d: Multi-Chain
const MultiChainScene: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const chains = [
    { name: "Base", color: "#1040C0", letter: "B" },
    { name: "Ethereum", color: "#627EEA", letter: "E" },
    { name: "Polygon", color: "#8247E5", letter: "P" },
    { name: "Unichain", color: "#D02020", letter: "U" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Chain icons */}
        <div style={{ display: "flex", gap: 20 }}>
          {chains.map((chain, i) => (
            <ChainIcon
              key={chain.name}
              {...chain}
              enterFrame={startFrame + 8 + i * 8}
            />
          ))}
        </div>

        <MontageTitle
          title="4 Chains Supported"
          subtitle="Base, Ethereum, Polygon, Unichain"
          startFrame={startFrame}
        />
      </div>
    </AbsoluteFill>
  );
};

const ChainIcon: React.FC<{
  name: string;
  color: string;
  letter: string;
  enterFrame: number;
}> = ({ color, letter, enterFrame }) => {
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
        width: 80,
        height: 80,
        borderRadius: "50%",
        backgroundColor: color,
        border: "3px solid #121212",
        boxShadow: "4px 4px 0px 0px #121212",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 32,
          color: "#FFFFFF",
        }}
      >
        {letter}
      </span>
    </div>
  );
};

export const MontageScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  return (
    <AbsoluteFill>
      <SubScene startFrame={startFrame}>
        <FullScreenScene startFrame={startFrame} />
      </SubScene>
      <SubScene startFrame={startFrame + SUB_SCENE_DURATION}>
        <SidepanelScene startFrame={startFrame + SUB_SCENE_DURATION} />
      </SubScene>
      <SubScene startFrame={startFrame + SUB_SCENE_DURATION * 2}>
        <ImpersonateScene startFrame={startFrame + SUB_SCENE_DURATION * 2} />
      </SubScene>
      <SubScene startFrame={startFrame + SUB_SCENE_DURATION * 3}>
        <MultiChainScene startFrame={startFrame + SUB_SCENE_DURATION * 3} />
      </SubScene>
    </AbsoluteFill>
  );
};
