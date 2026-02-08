import React from "react";
import { AbsoluteFill } from "remotion";
import { Word } from "./Word";
import { BankrLogo } from "../../components/BankrLogo";

const WORDS: { text: string; frame: number }[] = [
  { text: "AI", frame: 15 },
  { text: "Agents", frame: 35 },
  { text: "Need", frame: 55 },
  { text: "Wallets", frame: 75 },
];

export const AIAgentsNeedWallets: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Words */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
          maxWidth: 1600,
          padding: "0 80px",
        }}
      >
        {WORDS.map((w) => (
          <Word key={w.text} text={w.text} enterFrame={w.frame} />
        ))}
      </div>

      {/* Logo - bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 80,
        }}
      >
        <BankrLogo enterFrame={100} />
      </div>
    </AbsoluteFill>
  );
};
