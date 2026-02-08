import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

const ParamItem: React.FC<{
  name: string;
  value: string;
  enterFrame: number;
  indent?: number;
}> = ({ name, value, enterFrame, indent = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        paddingLeft: indent * 20,
        opacity: progress,
        transform: `translateX(${(1 - progress) * 15}px)`,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 600,
          fontSize: 13,
          color: "#888",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 13,
          color: "#F0C020",
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
};

export const MockSignatureRequest: React.FC<{
  enterFrame: number;
}> = ({ enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: progress,
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0 }}>
        <div
          style={{
            flex: 1,
            padding: "10px 0",
            backgroundColor: "#1040C0",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 13,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            Structured
          </span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "10px 0",
            backgroundColor: "#E0E0E0",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 13,
              color: "#888",
              textTransform: "uppercase",
            }}
          >
            Raw
          </span>
        </div>
      </div>

      {/* Type name badge */}
      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          backgroundColor: "#1040C0",
          padding: "6px 14px",
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 14,
            color: "#FFFFFF",
          }}
        >
          PermitWitnessTransferFrom
        </span>
      </div>

      {/* Params */}
      <div
        style={{
          backgroundColor: "#F8F8F8",
          border: "2px solid #E0E0E0",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <ParamItem
          name="permitted.token"
          value="0x833...5fc2"
          enterFrame={enterFrame + 6}
          indent={0}
        />
        <ParamItem
          name="permitted.amount"
          value="1000000000"
          enterFrame={enterFrame + 10}
          indent={0}
        />
        <ParamItem
          name="spender"
          value="0x3fC...91E4"
          enterFrame={enterFrame + 14}
          indent={0}
        />
        <ParamItem
          name="nonce"
          value="47291038475"
          enterFrame={enterFrame + 18}
          indent={0}
        />
        <ParamItem
          name="deadline"
          value="1735689600"
          enterFrame={enterFrame + 22}
          indent={0}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <div
          style={{
            flex: 1,
            padding: "14px 0",
            backgroundColor: "#FFFFFF",
            border: "3px solid #D02020",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 15,
              color: "#D02020",
              textTransform: "uppercase",
            }}
          >
            Reject
          </span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "14px 0",
            backgroundColor: "#22C55E",
            border: "3px solid #121212",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 15,
              color: "#FFFFFF",
              textTransform: "uppercase",
            }}
          >
            Sign
          </span>
        </div>
      </div>
    </div>
  );
};
