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

const { fontFamily } = loadFont();

/**
 * Scene 4 — Feature Showcase (480 frames / 16s)
 *
 * Header text (0-30), then 8 features rapid-fire (~56 frames each).
 * Reiterates V1 features so new viewers associate them with WalletChan.
 */

// ── Sub-scene orchestrator ──────────────────────────────────────────

const SUB_DURATION = 56;

const SubScene: React.FC<{
  children: React.ReactNode;
  startFrame: number;
  duration?: number;
}> = ({ children, startFrame, duration = SUB_DURATION }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame || frame >= startFrame + duration) return null;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

// ── Shared feature layout ───────────────────────────────────────────

const FeatureSlide: React.FC<{
  title: string;
  subtitle: string;
  titleColor?: string;
  startFrame: number;
  children: React.ReactNode;
}> = ({ title, subtitle, titleColor = "#D02020", startFrame, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleP = spring({
    frame: frame - (startFrame + 3),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const contentP = spring({
    frame: frame - (startFrame + 8),
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const subP = spring({
    frame: frame - (startFrame + 18),
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
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${titleP})`,
          opacity: titleP,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 48,
            color: titleColor,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {title}
        </span>
      </div>

      {/* Visual content */}
      <div
        style={{
          opacity: contentP,
          transform: `scale(${contentP * 0.1 + 0.9}) translateY(${(1 - contentP) * 20}px)`,
        }}
      >
        {children}
      </div>

      {/* Subtitle — TikTok style */}
      {subtitle && (
        <div
          style={{
            position: "absolute",
            bottom: 180,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: subP,
            transform: `translateY(${(1 - subP) * 15}px)`,
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 34,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1.35,
              maxWidth: 880,
              textShadow:
                "0 2px 8px rgba(0,0,0,0.7), 0 0px 20px rgba(0,0,0,0.5)",
              backgroundColor: "rgba(18, 18, 18, 0.75)",
              padding: "16px 28px",
              borderRadius: 12,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Feature 1: Agent Password ───────────────────────────────────────

const PermissionRow: React.FC<{
  label: string;
  allowed: boolean;
  highlight?: boolean;
}> = ({ label, allowed, highlight = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 18px",
      backgroundColor: highlight ? "rgba(208, 32, 32, 0.08)" : "transparent",
      border: highlight ? "2px solid #D02020" : "2px solid transparent",
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        backgroundColor: allowed ? "#22C55E" : "#D02020",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily, fontWeight: 900, fontSize: 18, color: "#FFF" }}>
        {allowed ? "\u2713" : "\u2717"}
      </span>
    </div>
    <span
      style={{
        fontFamily,
        fontWeight: 700,
        fontSize: 22,
        color: highlight ? "#D02020" : "#121212",
      }}
    >
      {label}
    </span>
  </div>
);

const AgentPasswordFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Agent Password"
    subtitle="Let AI transact with guardrails"
    startFrame={startFrame}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: 500,
        marginTop: 20,
      }}
    >
      {/* Header card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "3px solid #121212",
          boxShadow: "6px 6px 0px 0px #121212",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            backgroundColor: "#1040C0",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 26 }}>🤖</span>
        </div>
        <div>
          <div
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 20,
              color: "#121212",
              textTransform: "uppercase",
            }}
          >
            Agent Password
          </div>
          <div style={{ fontFamily, fontWeight: 500, fontSize: 14, color: "#888" }}>
            Separate access for AI agents
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div
        style={{
          backgroundColor: "#F8F8F8",
          border: "2px solid #E0E0E0",
          padding: "8px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <PermissionRow label="Sign Transactions" allowed />
        <PermissionRow label="Sign Messages" allowed />
        <PermissionRow label="Reveal Private Keys" allowed={false} highlight />
      </div>
    </div>
  </FeatureSlide>
);

// ── Feature 2: Account Types ────────────────────────────────────────

const MiniCard: React.FC<{
  icon: string;
  iconBg: string;
  title: string;
}> = ({ icon, iconBg, title }) => (
  <div
    style={{
      width: 200,
      backgroundColor: "#FFFFFF",
      border: "3px solid #121212",
      boxShadow: "4px 4px 0px 0px #121212",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        backgroundColor: iconBg,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #121212",
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
    </div>
    <span
      style={{
        fontFamily,
        fontWeight: 900,
        fontSize: 15,
        color: "#121212",
        textTransform: "uppercase",
        textAlign: "center",
      }}
    >
      {title}
    </span>
  </div>
);

const AccountTypesFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Multi Account Types"
    subtitle="Your keys, your way"
    startFrame={startFrame}
  >
    <div
      style={{
        display: "flex",
        gap: 20,
        justifyContent: "center",
        marginTop: 20,
      }}
    >
      <MiniCard icon="🤖" iconBg="#1040C0" title="Bankr API" />
      <MiniCard icon="🔑" iconBg="#F0C020" title="Private Key" />
      <MiniCard icon="🌱" iconBg="#D02020" title="Seed Phrase" />
    </div>
  </FeatureSlide>
);

// ── Feature 3: Decoded Transactions ─────────────────────────────────

const DecodedTxFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Decoded Transactions"
    subtitle="Know what you're signing"
    startFrame={startFrame}
  >
    <Img
      src={staticFile("TransactionRequest.png")}
      style={{
        height: 600,
        borderRadius: 12,
        boxShadow: "8px 8px 0px 0px #121212",
        border: "3px solid #121212",
        marginTop: 20,
      }}
    />
  </FeatureSlide>
);

// ── Feature 4: Typed Signatures ─────────────────────────────────────

const SignaturesFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Typed Signatures"
    subtitle="Human-readable signing"
    startFrame={startFrame}
  >
    <Img
      src={staticFile("SignatureRequest.png")}
      style={{
        height: 600,
        borderRadius: 12,
        boxShadow: "8px 8px 0px 0px #121212",
        border: "3px solid #121212",
        marginTop: 20,
      }}
    />
  </FeatureSlide>
);

// ── Feature 5: 5 Chains ────────────────────────────────────────────

const CHAINS = [
  { name: "Base", svg: "base.svg" },
  { name: "ETH", svg: "ethereum.svg" },
  { name: "MegaETH", svg: "megaeth.svg" },
  { name: "Polygon", svg: "polygon.svg" },
  { name: "Unichain", svg: "unichain.svg" },
];

const ChainIcon: React.FC<{
  svg: string;
  enterFrame: number;
}> = ({ svg, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({
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
        border: "3px solid #121212",
        boxShadow: "4px 4px 0px 0px #121212",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${p})`,
        opacity: p,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile(svg)}
        style={{ width: 52, height: 52 }}
      />
    </div>
  );
};

const ChainsFeature: React.FC<{ startFrame: number }> = ({ startFrame }) => (
  <FeatureSlide
    title="5 Chains Supported"
    subtitle="Base · Ethereum · MegaETH · Polygon · Unichain"
    startFrame={startFrame}
  >
    <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
      {CHAINS.map((c, i) => (
        <ChainIcon
          key={c.name}
          svg={c.svg}
          enterFrame={startFrame + 10 + i * 5}
        />
      ))}
    </div>
  </FeatureSlide>
);

// ── Feature 6: Sidepanel + Full-Screen ──────────────────────────────

const SidepanelFSFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Sidepanel & Full-Screen"
    subtitle="For humans and AI agents"
    startFrame={startFrame}
  >
    <div style={{ display: "flex", gap: 32, alignItems: "center", marginTop: 20 }}>
      {/* Sidepanel mockup */}
      <div style={{ display: "flex", gap: 0 }}>
        <div
          style={{
            width: 240,
            height: 200,
            border: "3px solid #E0E0E0",
            backgroundColor: "#F8F8F8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily, fontWeight: 600, fontSize: 16, color: "#CCC" }}>
            Browser Tab
          </span>
        </div>
        <div
          style={{
            width: 120,
            height: 200,
            border: "3px solid #121212",
            boxShadow: "4px 4px 0px 0px #121212",
            backgroundColor: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Img
            src={staticFile("walletchan-icon-nobg.png")}
            style={{ width: 36, height: 36 }}
          />
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 9,
              color: "#121212",
              textTransform: "uppercase",
            }}
          >
            Sidepanel
          </span>
        </div>
      </div>

      {/* Divider */}
      <span style={{ fontFamily, fontWeight: 900, fontSize: 32, color: "#CCC" }}>+</span>

      {/* Full-screen mockup */}
      <div
        style={{
          width: 280,
          height: 200,
          border: "3px solid #121212",
          boxShadow: "6px 6px 0px 0px #121212",
          backgroundColor: "#F8F8F8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily, fontSize: 36, color: "#1040C0" }}>⤢</span>
      </div>
    </div>
  </FeatureSlide>
);

// ── Feature 7: Impersonate ──────────────────────────────────────────

const ImpersonateFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Impersonate Any Address"
    subtitle="View-only mode for any wallet"
    startFrame={startFrame}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        marginTop: 20,
      }}
    >
      <div
        style={{
          width: 500,
          padding: "14px 22px",
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
          vitalik.eth
        </span>
      </div>
      <div
        style={{
          backgroundColor: "#F0C020",
          padding: "6px 20px",
          border: "2px solid #121212",
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
  </FeatureSlide>
);

// ── Feature 8: Portfolio & Transfers ────────────────────────────────

const PortfolioFeature: React.FC<{ startFrame: number }> = ({
  startFrame,
}) => (
  <FeatureSlide
    title="Portfolio · Transfers · History"
    subtitle=""
    startFrame={startFrame}
  >
    <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
      <Img
        src={staticFile("Portfolio-new.png")}
        style={{
          height: 500,
          borderRadius: 10,
          boxShadow: "6px 6px 0px 0px #121212",
          border: "2px solid #121212",
        }}
      />
      <Img
        src={staticFile("TokenTransfer.png")}
        style={{
          height: 500,
          borderRadius: 10,
          boxShadow: "6px 6px 0px 0px #121212",
          border: "2px solid #121212",
        }}
      />
    </div>
  </FeatureSlide>
);

// ── Feature 9: Chat with Bankr ──────────────────────────────────────

const ChatBullet: React.FC<{
  text: string;
  enterFrame: number;
}> = ({ text, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: p,
        transform: `translateX(${(1 - p) * 30}px)`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          backgroundColor: "#1040C0",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 28,
          color: "#121212",
        }}
      >
        {text}
      </span>
    </div>
  );
};

const ChatFeature: React.FC<{ startFrame: number }> = ({ startFrame }) => (
  <FeatureSlide
    title="Chat with Bankr"
    subtitle="AI-powered actions on any dapp"
    startFrame={startFrame}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        marginTop: 20,
      }}
    >
      {/* Chat button mockup */}
      <div
        style={{
          backgroundColor: "#F0C020",
          padding: "20px 48px",
          border: "3px solid #121212",
          boxShadow: "6px 6px 0px 0px #121212",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ fontSize: 28 }}>💬</span>
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 32,
            color: "#121212",
            textTransform: "uppercase",
          }}
        >
          Chat with Bankr
        </span>
      </div>

      {/* Bullet points */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <ChatBullet text="Chat via Bankr API on any page!" enterFrame={startFrame + 14} />
        <ChatBullet text="View Chat history" enterFrame={startFrame + 20} />
        <ChatBullet text="And much more!" enterFrame={startFrame + 26} />
      </div>
    </div>
  </FeatureSlide>
);

// ── Main export ─────────────────────────────────────────────────────

export const FeatureShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header: "Everything You Love. Now WalletChan."
  const headerP = spring({
    frame: frame - 3,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });

  const headerFade = frame < 30 ? 1 : Math.max(0, 1 - (frame - 30) / 5);

  return (
    <AbsoluteFill>
      {/* Header text (frames 0-35) */}
      {frame < 35 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              transform: `scale(${headerP})`,
              opacity: headerP * headerFade,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 56,
                color: "#121212",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              Everything You Love.
            </span>
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 56,
                color: "#1040C0",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Now WalletChan.
            </span>
          </div>
        </AbsoluteFill>
      )}

      {/* Feature sub-scenes */}
      <SubScene startFrame={35}>
        <AgentPasswordFeature startFrame={35} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION}>
        <AccountTypesFeature startFrame={35 + SUB_DURATION} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 2}>
        <DecodedTxFeature startFrame={35 + SUB_DURATION * 2} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 3}>
        <SignaturesFeature startFrame={35 + SUB_DURATION * 3} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 4}>
        <ChainsFeature startFrame={35 + SUB_DURATION * 4} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 5}>
        <SidepanelFSFeature startFrame={35 + SUB_DURATION * 5} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 6}>
        <ImpersonateFeature startFrame={35 + SUB_DURATION * 6} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 7}>
        <PortfolioFeature startFrame={35 + SUB_DURATION * 7} />
      </SubScene>
      <SubScene startFrame={35 + SUB_DURATION * 8}>
        <ChatFeature startFrame={35 + SUB_DURATION * 8} />
      </SubScene>
    </AbsoluteFill>
  );
};
