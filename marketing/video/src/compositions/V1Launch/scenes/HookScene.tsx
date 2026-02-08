import React from "react";
import { AbsoluteFill } from "remotion";
import { Word } from "../../AIAgentsNeedWallets/Word";

const WORDS: { text: string; frame: number }[] = [
  { text: "AI", frame: 15 },
  { text: "Agents", frame: 36 },
  { text: "Need", frame: 54 },
  { text: "Wallets", frame: 75 },
];

export const HookScene: React.FC = () => {
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
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
          maxWidth: 900,
          padding: "0 60px",
        }}
      >
        {WORDS.map((w) => (
          <Word key={w.text} text={w.text} enterFrame={w.frame} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
