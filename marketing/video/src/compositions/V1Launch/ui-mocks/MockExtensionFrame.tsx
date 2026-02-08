import React from "react";
import { Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont();

export const MockExtensionFrame: React.FC<{
  children: React.ReactNode;
  width?: number;
  height?: number;
}> = ({ children, width = 420, height = 620 }) => {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#FFFFFF",
        border: "3px solid #121212",
        boxShadow: "8px 8px 0px 0px #121212",
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          backgroundColor: "#121212",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Img
            src={staticFile("bankrwallet-icon.png")}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
            }}
          />
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 14,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            BankrWallet
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#F0C020",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#D02020",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
