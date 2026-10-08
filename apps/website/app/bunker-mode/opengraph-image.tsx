import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mascotLayers } from "./mascotLayers";
import { palette } from "../home-v2/design";
export const alt =
  "Bunker Mode by WalletChan. Check your address across 25 chains.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const [anton, outfit, ...layers] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/bunker/anton.woff")),
    readFile(join(process.cwd(), "public/fonts/bunker/outfit.woff")),
    ...mascotLayers("idle").map((path) =>
      readFile(join(process.cwd(), "public", path)),
    ),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 56,
          background: palette.ink,
          color: palette.white,
          fontFamily: "Outfit",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 30 }}>
          WALLETCHAN
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontFamily: "Anton", fontSize: 96 }}>
              Bunker mode.
            </div>
            <div style={{ display: "flex", fontSize: 32 }}>
              Is your address&nbsp;
              <span style={{ color: palette.yellow }}>safe</span>?
            </div>
          </div>
          <div
            style={{
              display: "flex",
              position: "absolute",
              right: 0,
              width: 370,
              height: 370,
            }}
          >
            {layers.map((layer, i) => (
              <img
                key={i}
                src={`data:image/png;base64,${layer.toString("base64")}`}
                alt=""
                width={370}
                height={370}
                style={{ position: "absolute", inset: 0 }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: palette.yellow }}>
          walletchan.com/bunker-mode
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Anton", data: anton, weight: 400, style: "normal" },
        { name: "Outfit", data: outfit, weight: 500, style: "normal" },
      ],
    },
  );
}
