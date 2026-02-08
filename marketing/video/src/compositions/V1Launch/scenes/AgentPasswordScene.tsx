import React from "react";
import { AbsoluteFill } from "remotion";
import { FeatureLabel } from "../../../components/FeatureLabel";
import { TextOverlay } from "../../../components/TextOverlay";
import { MockAgentPassword } from "../ui-mocks/MockAgentPassword";

export const AgentPasswordScene: React.FC<{
  startFrame: number;
}> = ({ startFrame }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <FeatureLabel text="Agent Password" enterFrame={startFrame + 5} />

      <div style={{ marginTop: 40, width: 700 }}>
        <MockAgentPassword enterFrame={startFrame + 15} />
      </div>

      <TextOverlay
        text="Separate password for AI agents — they can never leak your private keys"
        enterFrame={startFrame + 40}
      />
    </AbsoluteFill>
  );
};
