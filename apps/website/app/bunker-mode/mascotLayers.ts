import type { Verdict } from "./model";
const ROOT = "/images/bunker-mascot/";
export function mascotLayers(mood: Verdict | "idle"): string[] {
  if (mood === "active") return [ROOT + "face-spiral-neutral-v1.png"];
  return [
    "face-base-neutral-clean.png",
    "eye-left-open.png",
    mood === "clean" || mood === "contract" ? "eye-right-closed.png" : "eye-right-open.png",
    mood === "clean" || mood === "contract"
      ? "mouth-success-extracted.png"
      : "mouth-idle-approved.png",
  ].map((file) => ROOT + file);
}
