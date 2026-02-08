import React from "react";
import { AbsoluteFill } from "remotion";
import { FeatureLabel } from "../../../components/FeatureLabel";
import { TextOverlay } from "../../../components/TextOverlay";
import { MockAccountCards } from "../ui-mocks/MockAccountCards";

export const AccountTypesScene: React.FC<{
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
      <FeatureLabel text="3 Account Types" enterFrame={startFrame + 5} />

      <div style={{ marginTop: 40 }}>
        <MockAccountCards enterFrame={startFrame + 15} />
      </div>

      <TextOverlay
        text="Import existing wallets alongside Bankr API accounts"
        enterFrame={startFrame + 50}
      />
    </AbsoluteFill>
  );
};
